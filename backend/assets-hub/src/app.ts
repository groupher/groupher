/**
 * Composes the Assets Hub HTTP application and its injected route dependencies.
 *
 * Business position:
 *
 *   Dashboard / Phoenix capability
 *     -> Assets Hub module
 *     -> R2 / measured result
 *     -> Phoenix asset state
 */

import { createHash } from 'node:crypto'
import path from 'node:path'

import { bearerToken, serviceTokenErrorStatus } from '@groupher/service/auth'
import { createHealthResponse } from '@groupher/service/health'
import { jsonResponse } from '@groupher/service/http'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import {
  verifyBatchCapability,
  verifyCapability,
  verifyPublishClaim,
  verifyReviewReadCapability,
  type TUploadCapability,
} from './capability'
import { LocalGeneratedBatchStore } from './local-batch'
import { LocalObjectStore } from './local-storage'
import { completePhoenixUpload, fetchAssetOriginInfo, registerGeneratedAsset } from './phoenix'
import {
  createPresignedGetUrl,
  createPresignedPutUrl,
  getR2ObjectBytes,
  headR2Object,
  smokeR2,
} from './r2'
import {
  createAssetsHubInternalVerifier,
  DEFAULT_SERVICE_AUTH_ISSUER,
  DEFAULT_SERVICE_AUTH_JWKS_URL,
  type TAssetsHubInternalVerifier,
} from './service-auth'

type TOptions = {
  environment?: Record<string, string | undefined>
}

const localInternalScopes = {
  assetDelete: 'assets:object:delete',
  generatedBatchClaim: 'assets:generated-batch:claim',
  generatedBatchCleanup: 'assets:generated-batch:cleanup',
  generatedBatchRegister: 'assets:generated-batch:register',
} as const

type TTiming = {
  duration: number
  label: string
}

const json = jsonResponse
const uploadExpiresInSeconds = 10 * 60
const defaultCorsOrigins = [
  'http://localhost:3003',
  'http://groupher.localhost:3003',
  'https://groupher.localhost',
  'http://dash.groupher.localhost:3103',
  'http://apply.groupher.localhost',
  'https://apply.groupher.localhost',
  'http://dash.groupher.localhost',
  'https://dash.groupher.localhost',
]

const corsOrigin = (environment: Record<string, string | undefined>) => {
  const configuredOrigins = environment.ASSETS_HUB_CORS_ORIGIN?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  const origins = configuredOrigins?.length ? configuredOrigins : defaultCorsOrigins

  return (origin: string) => {
    if (!origin) return origins[0]
    return origins.includes('*') || origins.includes(origin) ? origin : origins[0]
  }
}

const parseCapabilityInput = async (context: { req: { json: () => Promise<unknown> } }) => {
  const input = await context.req.json().catch(() => null)
  const capability =
    typeof (input as { capability?: unknown })?.capability === 'string'
      ? (input as { capability: string }).capability.trim()
      : ''

  if (!capability) throw new Error('capability is required')
  return capability
}

const checksumBase64ToHex = (checksum: string) => Buffer.from(checksum, 'base64').toString('hex')

const sha256Hash = (buffer: Buffer) => `sha256:${createHash('sha256').update(buffer).digest('hex')}`

const formatSize = (value: unknown) => {
  if (typeof value !== 'number') return '-'
  if (value < 1024) return `${value}B`
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)}KB`
  return `${(value / 1024 / 1024).toFixed(1)}MB`
}

const formatDuration = (value: unknown) => {
  if (typeof value !== 'number') return '-'
  if (value < 1000) return `${Math.round(value)}ms`
  return `${(value / 1000).toFixed(2)}s`
}

const formatTimings = (value: unknown) => {
  if (!Array.isArray(value) || value.length === 0) return '-'

  return value
    .map((item) => {
      const label = typeof item?.label === 'string' ? item.label : 'step'
      return `${label}:${formatDuration(item?.duration)}`
    })
    .join(',')
}

const pad = (value: unknown, size: number) =>
  String(value ?? '-')
    .padEnd(size)
    .slice(0, size)

const logUpload = (event: string, payload: Record<string, unknown>) => {
  const row = [
    '[assets-hub]',
    pad(event, 24),
    `community=${payload.communitySlug ?? '-'}`,
    `file=${payload.filename ?? '-'}`,
    `size=${formatSize(payload.sizeBytes)}`,
    `asset=${payload.assetPublicRef ?? '-'}`,
    `upload=${payload.uploadRef ?? '-'}`,
    `timing=${formatTimings(payload.timings)}`,
    payload.message ? `msg=${payload.message}` : '',
  ].filter(Boolean)

  console.info(row.join(' | '))
}

const timed = async <T>(label: string, timings: TTiming[], task: () => Promise<T>) => {
  const startedAt = performance.now()
  try {
    return await task()
  } finally {
    timings.push({ duration: performance.now() - startedAt, label })
  }
}

const objectContentHash = async (capability: TUploadCapability, localStore?: LocalObjectStore) => {
  if (capability.checksumSha256) return `sha256:${checksumBase64ToHex(capability.checksumSha256)}`

  const buffer = localStore
    ? await localStore.getObjectBytes(capability.objectKey)
    : await getR2ObjectBytes(capability.objectKey)
  return sha256Hash(buffer)
}

const isLocalRuntime = (environment: Record<string, string | undefined>) =>
  environment.ASSETS_HUB_RUNTIME === 'local'

const createInternalRequestVerifier = (
  issuer: string | null,
  jwksUrl: string | null,
): TAssetsHubInternalVerifier | null => {
  if (!issuer || !jwksUrl) return null

  try {
    return createAssetsHubInternalVerifier(issuer, jwksUrl)
  } catch (error) {
    console.warn('[assets-hub] Invalid service-auth verifier configuration', {
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

const authorizeInternalRequest = async (
  context: { req: { header: (name: string) => string | undefined } },
  verifier: TAssetsHubInternalVerifier | null,
  scope: string,
  allowedSubjects: readonly string[] = ['service:phoenix'],
): Promise<null | 401 | 403> => {
  const token = bearerToken(context.req.header('authorization'))
  if (!token || !verifier) return 401

  try {
    const actor = await verifier.verify(token, scope)
    return allowedSubjects.includes(actor.subject) ? null : 403
  } catch (error) {
    return serviceTokenErrorStatus(error)
  }
}

const internalAuthError = (status: 401 | 403) =>
  json(
    {
      error: {
        code: status === 403 ? 'service_scope_forbidden' : 'service_auth_required',
        message:
          status === 403
            ? 'The service identity does not grant this operation.'
            : 'A scoped service identity is required.',
      },
      ok: false,
    },
    status,
  )

const parseJson = async (context: { req: { json: () => Promise<unknown> } }) =>
  context.req.json().catch(() => null)

const parseCapability = (input: unknown) => {
  const capability = (input as { capability?: unknown } | null)?.capability
  if (typeof capability !== 'string' || !capability.trim())
    throw new Error('capability is required')
  return capability
}

/** Creates the assets hub application with injectable runtime dependencies. */
export const createApp = ({ environment = process.env }: TOptions = {}) => {
  const app = new Hono()
  const localRuntime = isLocalRuntime(environment)
  const serviceAuthIssuer =
    environment.SERVICE_AUTH_ISSUER?.trim() || (localRuntime ? null : DEFAULT_SERVICE_AUTH_ISSUER)
  const serviceAuthJwksUrl =
    environment.SERVICE_AUTH_JWKS_URL?.trim() ||
    (localRuntime ? null : DEFAULT_SERVICE_AUTH_JWKS_URL)
  const internalRequestVerifier = createInternalRequestVerifier(
    serviceAuthIssuer,
    serviceAuthJwksUrl,
  )
  const localStore = localRuntime
    ? new LocalObjectStore(
        environment.ASSETS_HUB_LOCAL_STORAGE_DIR ||
          path.resolve(process.cwd(), '.local/assets-hub'),
      )
    : undefined
  const localBatch = localStore ? new LocalGeneratedBatchStore(localStore, environment) : undefined

  app.use(
    '/uploads',
    cors({
      allowHeaders: ['content-type'],
      allowMethods: ['POST', 'OPTIONS'],
      origin: corsOrigin(environment),
    }),
  )

  app.use(
    '/uploads/*',
    cors({
      allowHeaders: ['content-type'],
      allowMethods: ['POST', 'OPTIONS'],
      origin: corsOrigin(environment),
    }),
  )

  app.use(
    '/dev/*',
    cors({
      allowHeaders: ['content-type'],
      allowMethods: ['POST', 'OPTIONS'],
      origin: corsOrigin(environment),
    }),
  )

  app.use(
    '/generated-batches',
    cors({
      allowHeaders: ['content-type'],
      allowMethods: ['POST', 'OPTIONS'],
      origin: corsOrigin(environment),
    }),
  )

  app.use(
    '/generated-batches/*',
    cors({
      allowHeaders: ['authorization', 'content-type'],
      allowMethods: ['POST', 'OPTIONS'],
      origin: corsOrigin(environment),
    }),
  )

  app.use(
    '/local/uploads/*',
    cors({
      allowHeaders: ['content-type'],
      allowMethods: ['PUT', 'OPTIONS'],
      exposeHeaders: ['etag', 'x-checksum-sha256'],
      origin: corsOrigin(environment),
    }),
  )

  app.use(
    '/a/*',
    cors({
      allowMethods: ['GET', 'HEAD', 'OPTIONS'],
      exposeHeaders: ['content-length', 'content-type', 'etag'],
      origin: corsOrigin(environment),
    }),
  )

  app.get('/health', (context) => context.json(createHealthResponse({ service: 'assets-hub' })))

  app.get('/health/ready', async () => {
    const required = [
      'ASSETS_HUB_CAPABILITY_SECRET',
      'PHOENIX_GRAPHQL_ENDPOINT',
      'SERVICE_AUTH_CLIENT_ID',
      'SERVICE_AUTH_CLIENT_SECRET',
      'SERVICE_AUTH_ISSUER',
      'SERVICE_AUTH_JWKS_URL',
      'SERVICE_AUTH_TOKEN_ENDPOINT',
    ]
    const missing = localRuntime ? required.filter((name) => !environment[name]?.trim()) : []
    const invalidServiceAuth = Boolean(
      serviceAuthIssuer && serviceAuthJwksUrl && !internalRequestVerifier,
    )
    if (missing.length || invalidServiceAuth) {
      const messages = [
        missing.length ? `Missing local configuration: ${missing.join(', ')}` : null,
        invalidServiceAuth ? 'Invalid service-auth verifier configuration.' : null,
      ].filter(Boolean)
      return json(
        {
          checks: messages.map((message) => ({ message, name: 'config', status: 'down' })),
          environment: 'development',
          schemaVersion: 'health.v1',
          service: 'assets-hub',
          status: 'down',
          timestamp: new Date().toISOString(),
          version: 'dev',
        },
        503,
      )
    }
    return json({
      checks: [{ name: 'config', status: 'ok' }],
      environment: 'development',
      schemaVersion: 'health.v1',
      service: 'assets-hub',
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: 'dev',
    })
  })

  app.post('/uploads', async (context) => {
    try {
      const capability = verifyCapability(await parseCapabilityInput(context), environment)
      const uploadUrl = localStore
        ? (await localStore.createUpload(capability),
          localStore.uploadUrl(capability.uploadRef, context.req.url))
        : await createPresignedPutUrl({
            checksumSha256: capability.checksumSha256,
            contentType: capability.declaredMimeType,
            expiresInSeconds: uploadExpiresInSeconds,
            key: capability.objectKey,
          })

      logUpload('asset_upload_presigned', {
        assetPublicRef: capability.purpose === 'asset.upload' ? capability.assetPublicRef : null,
        communityId: capability.purpose === 'asset.upload' ? capability.communityId : null,
        communitySlug: capability.purpose === 'asset.upload' ? capability.communitySlug : null,
        contentType: capability.declaredMimeType,
        filename: capability.declaredFilename,
        objectKey: capability.objectKey,
        sizeBytes: capability.declaredSizeBytes,
        uploadRef: capability.uploadRef,
      })

      return json({
        ok: true,
        result: {
          assetPublicRef: capability.purpose === 'asset.upload' ? capability.assetPublicRef : null,
          objectKey: capability.objectKey,
          upload: {
            headers: {
              'content-type': capability.declaredMimeType,
            },
            method: 'PUT',
            url: uploadUrl,
          },
        },
      })
    } catch (error) {
      logUpload('asset_upload_presign_failed', {
        message: error instanceof Error ? error.message : 'Upload intent rejected.',
      })

      return json(
        {
          error: {
            code: 'upload_intent_rejected',
            message: error instanceof Error ? error.message : 'Upload intent rejected.',
          },
          ok: false,
        },
        400,
      )
    }
  })

  app.on(['GET', 'HEAD'], '/review/:token', async (context) => {
    try {
      const capability = verifyReviewReadCapability(context.req.param('token'), environment)
      const head = localStore
        ? await localStore.headObject(capability.objectKey)
        : await headR2Object(capability.objectKey)
      const contentType =
        head?.ContentType || (head as { contentType?: string } | null)?.contentType
      const contentLength = head?.ContentLength || (head as { size?: number } | null)?.size

      if (
        !head ||
        !contentType ||
        contentType !== capability.mimeType ||
        !contentLength ||
        contentLength > 10 * 1024 * 1024
      ) {
        return new Response('Not found.', {
          headers: {
            'cache-control': 'no-store',
            'content-type': 'text/plain; charset=utf-8',
            'x-content-type-options': 'nosniff',
          },
          status: 404,
        })
      }

      const body =
        context.req.method === 'HEAD'
          ? null
          : localStore
            ? await localStore.getObjectBytes(capability.objectKey)
            : await getR2ObjectBytes(capability.objectKey)

      return new Response(body, {
        headers: {
          'cache-control': 'no-store',
          'content-length': String(contentLength),
          'content-type': contentType,
          'x-content-type-options': 'nosniff',
        },
      })
    } catch {
      return new Response('Not found.', {
        headers: {
          'cache-control': 'no-store',
          'content-type': 'text/plain; charset=utf-8',
          'x-content-type-options': 'nosniff',
        },
        status: 404,
      })
    }
  })

  app.put('/local/uploads/:uploadRef', async (context) => {
    if (!localStore)
      return json({ error: { code: 'not_found', message: 'Not found.' }, ok: false }, 404)
    try {
      const uploadRef = context.req.param('uploadRef')
      const body = Buffer.from(await context.req.arrayBuffer())
      const contentType = context.req.header('content-type') || ''
      const head = await localStore.putUpload(uploadRef, body, contentType)
      return new Response(null, {
        headers: {
          etag: head.ETag,
          'x-checksum-sha256': head.ChecksumSHA256,
        },
        status: 200,
      })
    } catch (error) {
      return json(
        {
          error: {
            code: 'local_upload_failed',
            message: error instanceof Error ? error.message : 'Local upload failed.',
          },
          ok: false,
        },
        400,
      )
    }
  })

  app.post('/uploads/:uploadRef/finalize', async (context) => {
    const timings: TTiming[] = []

    try {
      const capabilityToken = await parseCapabilityInput(context)
      const capability = verifyCapability(capabilityToken, environment)
      const uploadRef = context.req.param('uploadRef')
      if (uploadRef !== capability.uploadRef) throw new Error('uploadRef does not match capability')

      const head = await timed('providerHead', timings, async () => {
        if (localStore) return localStore.headObject(capability.objectKey)
        const value = await headR2Object(capability.objectKey)
        return value
          ? {
              ChecksumSHA256: value.ChecksumSHA256,
              ContentLength: value.ContentLength,
              ContentType: value.ContentType,
              ETag: value.ETag,
            }
          : null
      })
      if (!head) throw new Error('Uploaded object was not found')
      if (head.ContentLength !== capability.declaredSizeBytes) {
        throw new Error('Uploaded object size does not match capability')
      }
      if (head.ContentType !== capability.declaredMimeType) {
        throw new Error('Uploaded object content type does not match capability')
      }
      if (
        capability.checksumSha256 &&
        head.ChecksumSHA256 &&
        head.ChecksumSHA256 !== capability.checksumSha256
      ) {
        throw new Error('Uploaded object checksum does not match capability')
      }

      const contentHash = await timed('contentHash', timings, () =>
        objectContentHash(capability, localStore),
      )

      if (capability.purpose === 'generated_image') {
        await timed('batchAssetRegister', timings, () =>
          registerGeneratedAsset({
            capability,
            capabilityToken,
            environment,
            entry: {
              checksum: contentHash,
              storageKey: capability.objectKey,
            },
          }),
        )
      }

      const asset = await timed('phoenixComplete', timings, () =>
        completePhoenixUpload({
          capability,
          environment,
          input: {
            contentHash,
            idempotencyKey: capability.uploadRef,
            meta: {
              r2Head: {
                checksumSha256: head.ChecksumSHA256,
                etag: head.ETag,
              },
            },
            sizeBytes: capability.declaredSizeBytes,
            storage: 'r2',
          },
        }),
      )

      logUpload('asset_upload_finalized', {
        assetId: 'id' in asset ? asset.id : null,
        assetPublicRef: capability.purpose === 'asset.upload' ? capability.assetPublicRef : null,
        communityId: capability.purpose === 'asset.upload' ? capability.communityId : null,
        communitySlug: capability.purpose === 'asset.upload' ? capability.communitySlug : null,
        contentHash,
        contentType: capability.declaredMimeType,
        filename: capability.declaredFilename,
        objectKey: capability.objectKey,
        sizeBytes: capability.declaredSizeBytes,
        timings,
        uploadRef: capability.uploadRef,
      })

      return json({ ok: true, result: { asset, timings } })
    } catch (error) {
      logUpload('asset_upload_finalize_failed', {
        message: error instanceof Error ? error.message : 'Upload finalize failed.',
        timings,
      })

      return json(
        {
          error: {
            code: 'upload_finalize_failed',
            message: error instanceof Error ? error.message : 'Upload finalize failed.',
          },
          ok: false,
        },
        400,
      )
    }
  })

  app.post('/generated-batches', async (context) => {
    if (!localBatch)
      return json({ error: { code: 'not_found', message: 'Not found.' }, ok: false }, 404)
    try {
      const capability = verifyBatchCapability(
        parseCapability(await parseJson(context)),
        environment,
      )
      const batch = await localBatch.create(capability)
      return json({ ok: true, result: { batch } })
    } catch (error) {
      return json(
        {
          error: {
            code: 'generated_batch_create_failed',
            message:
              error instanceof Error ? error.message : 'Generated image batch creation failed.',
          },
          ok: false,
        },
        400,
      )
    }
  })

  app.post('/generated-batches/:batchRef/assets', async (context) => {
    if (!localBatch)
      return json({ error: { code: 'not_found', message: 'Not found.' }, ok: false }, 404)
    const authError = await authorizeInternalRequest(
      context,
      internalRequestVerifier,
      localInternalScopes.generatedBatchRegister,
      ['service:assets-hub'],
    )
    if (authError) return internalAuthError(authError)

    try {
      const body = await parseJson(context)
      const capability = verifyCapability(parseCapability(body), environment)
      const batchRef = context.req.param('batchRef')
      if (capability.purpose !== 'generated_image' || capability.batchRef !== batchRef) {
        throw new Error('Generated image capability does not match batch')
      }
      const input = body as {
        assetPublicRef?: unknown
        candidateOwnerRef?: unknown
        checksum?: unknown
        storageKey?: unknown
      }
      const checksum = typeof input.checksum === 'string' ? input.checksum.trim() : ''
      const storageKey = typeof input.storageKey === 'string' ? input.storageKey.trim() : ''
      if (!/^sha256:[0-9a-f]{64}$/i.test(checksum)) {
        throw new Error('Generated image checksum is invalid')
      }
      if (!storageKey || storageKey !== capability.objectKey) {
        throw new Error('Generated image storage key does not match capability')
      }
      const entry = {
        assetPublicRef: capability.assetPublicRef,
        candidateOwnerRef: capability.candidateOwnerRef,
        checksum,
        height: capability.declaredHeight,
        mimeType: capability.declaredMimeType,
        storageKey,
        variantKey: capability.variantKey,
        width: capability.declaredWidth,
      }
      if (input.assetPublicRef && input.assetPublicRef !== entry.assetPublicRef) {
        throw new Error('Generated image asset ref does not match capability')
      }
      if (input.candidateOwnerRef && input.candidateOwnerRef !== entry.candidateOwnerRef) {
        throw new Error('Generated image owner ref does not match capability')
      }
      await localBatch.registerAsset(batchRef, entry)
      return json({ ok: true, result: { entry } })
    } catch (error) {
      return json(
        {
          error: {
            code: 'generated_batch_asset_registration_failed',
            message:
              error instanceof Error ? error.message : 'Generated image asset registration failed.',
          },
          ok: false,
        },
        400,
      )
    }
  })

  app.post('/generated-batches/:batchRef/claim', async (context) => {
    if (!localBatch)
      return json({ error: { code: 'not_found', message: 'Not found.' }, ok: false }, 404)
    const authError = await authorizeInternalRequest(
      context,
      internalRequestVerifier,
      localInternalScopes.generatedBatchClaim,
    )
    if (authError) return internalAuthError(authError)

    try {
      const body = (await parseJson(context)) as { key?: unknown } | null
      const key = typeof body?.key === 'string' ? body.key : ''
      const batchRef = context.req.param('batchRef')
      const result = await localBatch.claimForPublish(batchRef, key)
      const capability = await localBatch.publishCapability(batchRef, result)
      return json({
        ok: true,
        result: {
          capability,
          claim: result.claim,
          manifest: result.manifest,
          manifestDigest: result.manifestDigest,
        },
      })
    } catch (error) {
      return json(
        {
          error: {
            code: 'generated_batch_claim_failed',
            message: error instanceof Error ? error.message : 'Generated image batch claim failed.',
          },
          ok: false,
        },
        400,
      )
    }
  })

  app.post('/generated-batches/:batchRef/cancel', async (context) => {
    if (!localBatch)
      return json({ error: { code: 'not_found', message: 'Not found.' }, ok: false }, 404)
    try {
      const capability = verifyBatchCapability(
        parseCapability(await parseJson(context)),
        environment,
      )
      const batchRef = context.req.param('batchRef')
      if (capability.batchRef !== batchRef)
        throw new Error('Generated batch ref does not match capability')
      await localBatch.cancel(batchRef)
      return json({ ok: true, result: { deleted: true } })
    } catch (error) {
      return json(
        {
          error: {
            code: 'generated_batch_cancel_failed',
            message:
              error instanceof Error ? error.message : 'Generated image batch cancellation failed.',
          },
          ok: false,
        },
        400,
      )
    }
  })

  app.post('/generated-batches/:batchRef/cleanup', async (context) => {
    if (!localBatch)
      return json({ error: { code: 'not_found', message: 'Not found.' }, ok: false }, 404)
    const authError = await authorizeInternalRequest(
      context,
      internalRequestVerifier,
      localInternalScopes.generatedBatchCleanup,
    )
    if (authError) return internalAuthError(authError)

    try {
      const claimToken = parseCapability(await parseJson(context))
      const claim = verifyPublishClaim(claimToken, environment)
      const batchRef = context.req.param('batchRef')
      if (claim.batchRef !== batchRef)
        throw new Error('Generated publish claim does not match batch')
      if (!claim.claimKey) throw new Error('Generated publish claim is missing claim key')
      const result = await localBatch.cleanup(batchRef, claim.claimKey)
      return json({ ok: true, result })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Generated image batch cleanup failed.'
      return json(
        { error: { code: 'generated_batch_cleanup_failed', message }, ok: false },
        message === 'GENERATED_IMAGE_BATCH_PUBLISH_STATUS_UNKNOWN' ? 503 : 400,
      )
    }
  })

  app.post('/internal/assets/delete', async (context) => {
    if (!localStore)
      return json({ error: { code: 'not_found', message: 'Not found.' }, ok: false }, 404)
    const authError = await authorizeInternalRequest(
      context,
      internalRequestVerifier,
      localInternalScopes.assetDelete,
    )
    if (authError) return internalAuthError(authError)
    const body = (await parseJson(context)) as { storage?: unknown; storageKey?: unknown } | null
    if (body?.storage !== 'r2' || typeof body.storageKey !== 'string' || !body.storageKey.trim()) {
      return json(
        {
          error: {
            code: 'invalid_asset_delete_request',
            message: 'Asset delete request is invalid.',
          },
          ok: false,
        },
        400,
      )
    }
    await localStore.deleteObject(body.storageKey)
    return json({ ok: true, result: { enqueued: true } })
  })

  app.on(['GET', 'HEAD'], '/a/:assetPublicRef/:variant', async (context) => {
    if (!localStore)
      return json({ error: { code: 'not_found', message: 'Not found.' }, ok: false }, 404)
    const variant = context.req.param('variant')
    if (variant !== 'original') {
      return json(
        {
          error: { code: 'asset_variant_not_found', message: 'Asset variant was not found.' },
          ok: false,
        },
        404,
      )
    }
    try {
      const origin = await fetchAssetOriginInfo({
        environment,
        publicRef: context.req.param('assetPublicRef'),
      })
      if (!origin || origin.status !== 'ACTIVE' || !origin.storageKey) {
        return json(
          { error: { code: 'asset_not_found', message: 'Asset was not found.' }, ok: false },
          404,
        )
      }
      const object = await localStore.headObject(origin.storageKey)
      if (!object)
        return json(
          { error: { code: 'asset_not_found', message: 'Asset was not found.' }, ok: false },
          404,
        )
      const headers = {
        'cache-control': 'public, max-age=3600',
        'content-length': String(object.ContentLength),
        'content-type': object.ContentType || origin.mimeType || 'application/octet-stream',
        etag: object.ETag,
      }
      if (context.req.method === 'HEAD') return new Response(null, { headers })
      return new Response(new Uint8Array(await localStore.getObjectBytes(origin.storageKey)), {
        headers,
      })
    } catch (error) {
      return json(
        {
          error: {
            code: 'asset_origin_lookup_failed',
            message: error instanceof Error ? error.message : 'Asset origin lookup failed.',
          },
          ok: false,
        },
        502,
      )
    }
  })

  app.post('/dev/r2-smoke', async () => {
    if (environment.NODE_ENV === 'production') {
      return json(
        {
          error: { code: 'not_found', message: 'Not found.' },
          ok: false,
        },
        404,
      )
    }

    try {
      const result = await smokeR2()
      return json({ ok: true, result })
    } catch (error) {
      return json(
        {
          error: {
            code: 'r2_smoke_failed',
            message: error instanceof Error ? error.message : 'R2 smoke failed.',
          },
          ok: false,
        },
        500,
      )
    }
  })

  app.post('/dev/presign-put', async (context) => {
    if (environment.NODE_ENV === 'production') {
      return json(
        {
          error: { code: 'not_found', message: 'Not found.' },
          ok: false,
        },
        404,
      )
    }

    const input = await context.req.json().catch(() => null)
    const key = typeof input?.key === 'string' ? input.key.trim() : ''
    const contentType = typeof input?.contentType === 'string' ? input.contentType.trim() : ''

    if (!key || !contentType) {
      return json(
        {
          error: {
            code: 'invalid_input',
            message: 'key and contentType are required.',
          },
          ok: false,
        },
        400,
      )
    }

    try {
      const uploadUrl = await createPresignedPutUrl({ contentType, key })
      return json({ ok: true, uploadUrl })
    } catch (error) {
      return json(
        {
          error: {
            code: 'presign_failed',
            message: error instanceof Error ? error.message : 'Presign failed.',
          },
          ok: false,
        },
        500,
      )
    }
  })

  app.post('/dev/presign', async (context) => {
    if (environment.NODE_ENV === 'production') {
      return json(
        {
          error: { code: 'not_found', message: 'Not found.' },
          ok: false,
        },
        404,
      )
    }

    const input = await context.req.json().catch(() => null)
    const key = typeof input?.key === 'string' ? input.key.trim() : ''

    if (!key) {
      return json(
        {
          error: {
            code: 'invalid_input',
            message: 'key is required.',
          },
          ok: false,
        },
        400,
      )
    }

    try {
      const url = await createPresignedGetUrl({ key })
      return json({ ok: true, url })
    } catch (error) {
      return json(
        {
          error: {
            code: 'presign_failed',
            message: error instanceof Error ? error.message : 'Presign failed.',
          },
          ok: false,
        },
        500,
      )
    }
  })

  return app
}

export default createApp()
