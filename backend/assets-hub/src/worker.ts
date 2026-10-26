/**
 * Exposes the Assets Hub Cloudflare Worker entrypoint.
 *
 * Business position:
 *
 *   Dashboard / Phoenix capability
 *     -> Assets Hub module
 *     -> R2 / measured result
 *     -> Phoenix asset state
 */

import type {
  TGeneratedImageManifestEntry,
  TGeneratedImageUploadBatch,
} from '@groupher/contracts/wallpaper'
import { bearerToken, serviceTokenErrorStatus } from '@groupher/service/auth'

import {
  signPayload,
  verifyBatchCapability,
  verifyPublishClaim,
  verifyCapability,
  verifyReviewReadCapability,
} from './capability'
import { GeneratedImageBatchDO } from './generated-batch-do'
import {
  fetchAssetOriginInfo,
  PhoenixGraphQLError,
  type TCommunityAssetOriginInfo,
} from './phoenix'
import {
  createAssetsHubInternalVerifier,
  DEFAULT_SERVICE_AUTH_ISSUER,
  DEFAULT_SERVICE_AUTH_JWKS_URL,
} from './service-auth'

type TAssetVariant = 'original' | 'thumbnail' | 'card'

type TAssetDeleteMessage = {
  assetId: number | string | null
  assetPublicRef: string | null
  communityId: number | string | null
  storage: 'r2'
  storageKey: string
}

const assetVariants = new Set<TAssetVariant>(['original', 'thumbnail', 'card'])
const originalCacheControl = 'public, max-age=3600'
const noStore = 'no-store'
const supportedStorageProviders = new Set(['r2'])
const corsHeaders = {
  'access-control-allow-origin': '*',
}
const startedAt = Date.now()
const SERVICE_AUTH_CONTRACT_PROBE_REF = 'dev-hub-assets-service-auth-contract-probe'

export const ASSETS_HUB_INTERNAL_SCOPE = {
  assetDelete: 'assets:object:delete',
  generatedBatchClaim: 'assets:generated-batch:claim',
  generatedBatchCleanup: 'assets:generated-batch:cleanup',
  generatedBatchRegister: 'assets:generated-batch:register',
} as const

const json = (input: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(input), {
    ...init,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...init?.headers,
    },
  })

const errorResponse = (
  code: string,
  message: string,
  status: number,
  headers: Record<string, string> = {},
) => json({ error: { code, message }, ok: false }, { headers, status })

/** Keeps the retryable Phoenix probe failure distinct from invalid cleanup input. */
export const generatedBatchCleanupHttpStatus = (message: string): 400 | 503 =>
  message === 'GENERATED_IMAGE_BATCH_PUBLISH_STATUS_UNKNOWN' ? 503 : 400

const parseJsonBody = async (request: Request) => request.json().catch(() => null)

const parseCapabilityBody = (body: unknown) => {
  const capability = (body as { capability?: unknown } | null)?.capability
  if (typeof capability !== 'string' || !capability.trim()) {
    throw new Error('capability is required')
  }
  return capability
}

const batchStub = (env: Env, batchRef: string) => env.GENERATED_IMAGE_BATCHES.getByName(batchRef)

const generatedBatchFromCapability = (capability: ReturnType<typeof verifyBatchCapability>) =>
  ({
    claim: null,
    expectedVariants: capability.expectedVariants,
    expiresAt: capability.expiresAt,
    publicRef: capability.batchRef,
    purpose: capability.purpose,
    requestDigest: capability.requestDigest,
    requestDigestVersion: capability.requestDigestVersion,
  }) satisfies TGeneratedImageUploadBatch

const handleGeneratedBatchCreate = async (request: Request, env: Env) => {
  try {
    const capability = verifyBatchCapability(parseCapabilityBody(await parseJsonBody(request)), env)
    const batch = await batchStub(env, capability.batchRef).create(
      generatedBatchFromCapability(capability),
    )
    return json({ ok: true, result: { batch } }, { headers: corsHeaders })
  } catch (error) {
    return errorResponse(
      'generated_batch_create_failed',
      error instanceof Error ? error.message : 'Generated image batch creation failed.',
      400,
      corsHeaders,
    )
  }
}

const handleGeneratedBatchAssetRegistration = async (
  request: Request,
  env: Env,
  batchRef: string,
) => {
  const authErrorStatus = await authorizeInternalRequest(
    request,
    env,
    ASSETS_HUB_INTERNAL_SCOPE.generatedBatchRegister,
    ['service:assets-hub'],
  )
  if (authErrorStatus) {
    return errorResponse(
      authErrorStatus === 403 ? 'service_scope_forbidden' : 'service_auth_required',
      authErrorStatus === 403
        ? 'The service identity does not grant this operation.'
        : 'A scoped service identity is required.',
      authErrorStatus,
    )
  }

  try {
    const body = await parseJsonBody(request)
    const capability = verifyCapability(parseCapabilityBody(body), env)
    if (capability.purpose !== 'generated_image' || capability.batchRef !== batchRef) {
      throw new Error('Generated image capability does not match batch')
    }
    const input = body as Partial<TGeneratedImageManifestEntry> | null
    const entry: TGeneratedImageManifestEntry = {
      assetPublicRef: capability.assetPublicRef,
      candidateOwnerRef: capability.candidateOwnerRef,
      checksum: typeof input?.checksum === 'string' ? input.checksum : '',
      height: capability.declaredHeight,
      mimeType: capability.declaredMimeType,
      storageKey: typeof input?.storageKey === 'string' ? input.storageKey : '',
      variantKey: capability.variantKey,
      width: capability.declaredWidth,
    }
    if (input?.assetPublicRef && input.assetPublicRef !== entry.assetPublicRef) {
      throw new Error('Generated image asset ref does not match capability')
    }
    if (input?.candidateOwnerRef && input.candidateOwnerRef !== entry.candidateOwnerRef) {
      throw new Error('Generated image owner ref does not match capability')
    }
    await batchStub(env, batchRef).registerAsset(entry)
    return json({ ok: true, result: { entry } }, { headers: corsHeaders })
  } catch (error) {
    return errorResponse(
      'generated_batch_asset_registration_failed',
      error instanceof Error ? error.message : 'Generated image asset registration failed.',
      400,
      corsHeaders,
    )
  }
}

const handleGeneratedBatchClaim = async (request: Request, env: Env, batchRef: string) => {
  const authErrorStatus = await authorizeInternalRequest(
    request,
    env,
    ASSETS_HUB_INTERNAL_SCOPE.generatedBatchClaim,
  )
  if (authErrorStatus) {
    return errorResponse(
      authErrorStatus === 403 ? 'service_scope_forbidden' : 'service_auth_required',
      authErrorStatus === 403
        ? 'The service identity does not grant this operation.'
        : 'A scoped service identity is required.',
      authErrorStatus,
      corsHeaders,
    )
  }

  try {
    const body = (await parseJsonBody(request)) as { key?: unknown } | null
    const key = typeof body?.key === 'string' ? body.key : ''
    const stub = batchStub(env, batchRef)
    const attempt = await stub.tryClaimForPublish(key)
    if (!attempt.ok) throw new Error(attempt.error)
    const result = attempt.value
    const batch = await stub.snapshot()
    if (!batch) throw new Error('GENERATED_IMAGE_BATCH_NOT_FOUND')
    const capability = signPayload(
      {
        batchRef,
        claimKey: result.claim.key,
        expiresAt: result.claim.expiresAt,
        manifest: result.manifest,
        manifestDigest: result.manifestDigest,
        policyVersion: env.ASSETS_HUB_BATCH_POLICY_VERSION || 'v1',
        purpose: 'generated_image_publish',
        requestDigest: batch.requestDigest,
        requestDigestVersion: batch.requestDigestVersion,
        signingKeyId: env.ASSETS_HUB_BATCH_SIGNING_KEY_ID || 'hmac-v1',
      },
      env,
    )
    return json(
      {
        ok: true,
        result: {
          capability,
          claim: result.claim,
          manifest: result.manifest,
          manifestDigest: result.manifestDigest,
        },
      },
      { headers: corsHeaders },
    )
  } catch (error) {
    return errorResponse(
      'generated_batch_claim_failed',
      error instanceof Error ? error.message : 'Generated image batch claim failed.',
      400,
      corsHeaders,
    )
  }
}

const handleGeneratedBatchCancel = async (request: Request, env: Env, batchRef: string) => {
  try {
    const capability = verifyBatchCapability(parseCapabilityBody(await parseJsonBody(request)), env)
    if (capability.batchRef !== batchRef)
      throw new Error('Generated batch ref does not match capability')
    const key = `${batchRef}:delete`
    const stub = batchStub(env, batchRef)
    await stub.claimForDelete(key)
    await stub.deleteClaimed(key)
    return json({ ok: true, result: { deleted: true } }, { headers: corsHeaders })
  } catch (error) {
    return errorResponse(
      'generated_batch_cancel_failed',
      error instanceof Error ? error.message : 'Generated image batch cancellation failed.',
      400,
      corsHeaders,
    )
  }
}

const handleGeneratedBatchCleanup = async (request: Request, env: Env, batchRef: string) => {
  const authErrorStatus = await authorizeInternalRequest(
    request,
    env,
    ASSETS_HUB_INTERNAL_SCOPE.generatedBatchCleanup,
  )
  if (authErrorStatus) {
    return errorResponse(
      authErrorStatus === 403 ? 'service_scope_forbidden' : 'service_auth_required',
      authErrorStatus === 403
        ? 'The service identity does not grant this operation.'
        : 'A scoped service identity is required.',
      authErrorStatus,
      corsHeaders,
    )
  }

  try {
    const capability = parseCapabilityBody(await parseJsonBody(request))
    const claim = verifyPublishClaim(capability, env)
    if (claim.batchRef !== batchRef || !claim.claimKey) {
      throw new Error('Generated publish claim does not match batch')
    }
    const attempt = await batchStub(env, batchRef).tryCleanupPublishClaim(claim.claimKey)
    if (!attempt.ok) throw new Error(attempt.error)
    return json({ ok: true, result: attempt.value }, { headers: corsHeaders })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Generated image batch cleanup failed.'
    return errorResponse(
      'generated_batch_cleanup_failed',
      message,
      generatedBatchCleanupHttpStatus(message),
      corsHeaders,
    )
  }
}

const handleGeneratedBatchRequest = async (request: Request, env: Env) => {
  const url = new URL(request.url)
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        ...corsHeaders,
        'access-control-allow-headers': 'authorization, content-type',
        'access-control-allow-methods': 'OPTIONS, POST',
      },
      status: 204,
    })
  }
  if (request.method !== 'POST')
    return errorResponse('method_not_allowed', 'Method not allowed.', 405)
  if (url.pathname === '/generated-batches') return handleGeneratedBatchCreate(request, env)

  const assetMatch = url.pathname.match(/^\/generated-batches\/([^/]+)\/assets$/)
  if (assetMatch) return handleGeneratedBatchAssetRegistration(request, env, assetMatch[1]!)
  const claimMatch = url.pathname.match(/^\/generated-batches\/([^/]+)\/claim$/)
  if (claimMatch) return handleGeneratedBatchClaim(request, env, claimMatch[1]!)
  const cancelMatch = url.pathname.match(/^\/generated-batches\/([^/]+)\/cancel$/)
  if (cancelMatch) return handleGeneratedBatchCancel(request, env, cancelMatch[1]!)
  const cleanupMatch = url.pathname.match(/^\/generated-batches\/([^/]+)\/cleanup$/)
  if (cleanupMatch) return handleGeneratedBatchCleanup(request, env, cleanupMatch[1]!)

  return errorResponse('not_found', 'Not found.', 404)
}

const authorizeInternalRequest = async (
  request: Request,
  env: Env,
  scope: string,
  allowedSubjects: readonly string[] = ['service:phoenix'],
): Promise<null | 401 | 403> => {
  const token = bearerToken(request.headers.get('authorization') || undefined)
  if (!token) return 401
  try {
    const verifier = createAssetsHubInternalVerifier(
      env.SERVICE_AUTH_ISSUER || DEFAULT_SERVICE_AUTH_ISSUER,
      env.SERVICE_AUTH_JWKS_URL || DEFAULT_SERVICE_AUTH_JWKS_URL,
    )
    const actor = await verifier.verify(token, scope)
    return allowedSubjects.includes(actor.subject) ? null : 403
  } catch (error) {
    return serviceTokenErrorStatus(error)
  }
}

const normalizeDeleteMessage = (input: unknown): TAssetDeleteMessage | null => {
  const body = input as Partial<TAssetDeleteMessage> | null
  const storageKey = typeof body?.storageKey === 'string' ? body.storageKey.trim() : ''

  if (body?.storage !== 'r2' || !storageKey) return null

  return {
    assetId: body.assetId ?? null,
    assetPublicRef: body.assetPublicRef ?? null,
    communityId: body.communityId ?? null,
    storage: 'r2',
    storageKey,
  }
}

const parseAssetPath = (pathname: string) => {
  const match = pathname.match(/^\/a\/([^/]+)\/([^/]+)$/)
  if (!match) return null

  const [, assetPublicRef, variant] = match
  if (!assetPublicRef || !assetVariants.has(variant as TAssetVariant)) return null

  return { assetPublicRef, variant: variant as TAssetVariant }
}

const assetNotFoundResponse = () =>
  errorResponse('asset_not_found', 'Asset was not found.', 404, {
    'cache-control': noStore,
    ...corsHeaders,
  })

const unsupportedStorageResponse = (storage: string | null) =>
  errorResponse(
    'asset_storage_not_supported',
    'Asset storage provider is not supported by this origin.',
    502,
    {
      'cache-control': noStore,
      ...corsHeaders,
      ...(storage ? { 'x-asset-storage': storage } : {}),
    },
  )

const encodeRFC5987Value = (input: string) =>
  encodeURIComponent(input).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  )

const contentDispositionValue = (filename: string | null) => {
  const trimmedFilename = filename?.trim()
  if (!trimmedFilename) return null

  const fallbackFilename =
    trimmedFilename.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_') || 'asset'

  return `inline; filename="${fallbackFilename}"; filename*=UTF-8''${encodeRFC5987Value(trimmedFilename)}`
}

const serveOriginalByStorageKey = async (
  env: Env,
  originInfo: TCommunityAssetOriginInfo,
  method: string,
) => {
  if (!originInfo.storageKey) {
    return errorResponse('asset_not_found', 'Asset object was not found.', 404, {
      'cache-control': noStore,
      ...corsHeaders,
    })
  }

  const object = await env.ASSETS_BUCKET.get(originInfo.storageKey)
  if (!object?.body) {
    return errorResponse('asset_not_found', 'Asset object was not found.', 404, {
      'cache-control': noStore,
      ...corsHeaders,
    })
  }

  const contentDisposition = contentDispositionValue(originInfo.filename)

  return new Response(method === 'HEAD' ? null : object.body, {
    headers: {
      'cache-control': originalCacheControl,
      ...corsHeaders,
      ...(contentDisposition ? { 'content-disposition': contentDisposition } : {}),
      ...(object.httpEtag ? { etag: object.httpEtag } : {}),
      'content-type':
        object.httpMetadata?.contentType || originInfo.mimeType || 'application/octet-stream',
      ...(typeof object.size === 'number' ? { 'content-length': String(object.size) } : {}),
    },
  })
}

const originLookupFailed = (error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Asset origin lookup failed before public read.'
  const status = error instanceof PhoenixGraphQLError && error.status >= 500 ? 503 : 502

  if (error instanceof PhoenixGraphQLError) {
    console.warn('[assets-hub] Phoenix origin lookup failed', {
      message,
      phoenixStatus: error.status,
      status,
    })
  }

  return errorResponse('asset_origin_lookup_failed', message, status, {
    'cache-control': noStore,
    ...corsHeaders,
  })
}

const healthResponse = ({
  env,
  checks = [],
  status = 'ok',
}: {
  env: Env
  checks?: Array<{
    name: string
    status: 'ok' | 'down'
    latencyMs?: number
    message?: string
  }>
  status?: 'ok' | 'down'
}) =>
  json(
    {
      schemaVersion: 'health.v1',
      status,
      service: 'assets-hub',
      version: env.VERSION || 'dev',
      environment: env.ENVIRONMENT || 'development',
      timestamp: new Date().toISOString(),
      uptimeMs: Date.now() - startedAt,
      checks,
    },
    { status: status === 'down' ? 503 : 200 },
  )

const serviceAuthContractProbe = async (env: Env) => {
  const startedAt = performance.now()

  try {
    const originInfo = await fetchAssetOriginInfo({
      environment: env,
      publicRef: SERVICE_AUTH_CONTRACT_PROBE_REF,
    })

    if (originInfo !== null) {
      return {
        latencyMs: Math.round(performance.now() - startedAt),
        message: 'Phoenix unexpectedly returned an origin for the reserved asset reference.',
        status: 'down' as const,
      }
    }

    return {
      latencyMs: Math.round(performance.now() - startedAt),
      status: 'ok' as const,
    }
  } catch (error) {
    return {
      latencyMs: Math.round(performance.now() - startedAt),
      message: error instanceof Error ? error.message : 'Assets service-auth contract failed.',
      status: 'down' as const,
    }
  }
}

const serveAsset = async (request: Request, env: Env) => {
  const url = new URL(request.url)
  const assetPath = parseAssetPath(url.pathname)
  if (!assetPath) return errorResponse('not_found', 'Not found.', 404)

  let originInfo: TCommunityAssetOriginInfo | null
  try {
    originInfo = await fetchAssetOriginInfo({
      environment: env,
      publicRef: assetPath.assetPublicRef,
    })
  } catch (error) {
    return originLookupFailed(error)
  }

  if (!originInfo || originInfo.status !== 'ACTIVE' || !originInfo.storageKey) {
    return assetNotFoundResponse()
  }

  if (assetPath.variant !== 'original') {
    return errorResponse('asset_variant_not_found', 'Asset variant was not found.', 404, {
      'cache-control': noStore,
      ...corsHeaders,
    })
  }

  if (!originInfo.storage || !supportedStorageProviders.has(originInfo.storage)) {
    return unsupportedStorageResponse(originInfo.storage)
  }

  return serveOriginalByStorageKey(env, originInfo, request.method)
}

const serveReviewImage = async (request: Request, env: Env, token: string) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    return errorResponse('method_not_allowed', 'Method not allowed.', 405, {
      allow: 'GET, HEAD',
      'cache-control': noStore,
    })
  }

  try {
    const capability = verifyReviewReadCapability(token, env)
    const object = await env.ASSETS_BUCKET.get(capability.objectKey)
    const contentType = object?.httpMetadata?.contentType

    if (
      !object ||
      typeof object.size !== 'number' ||
      object.size <= 0 ||
      object.size > 10 * 1024 * 1024 ||
      contentType !== capability.mimeType
    ) {
      return errorResponse('review_image_unavailable', 'Image is unavailable.', 404, {
        'cache-control': noStore,
        'x-content-type-options': 'nosniff',
      })
    }

    const headers = new Headers({
      'cache-control': noStore,
      'content-length': String(object.size),
      'content-type': contentType,
      'x-content-type-options': 'nosniff',
    })
    return new Response(request.method === 'HEAD' ? null : object.body, { headers })
  } catch {
    return errorResponse('review_image_unavailable', 'Image is unavailable.', 404, {
      'cache-control': noStore,
      'x-content-type-options': 'nosniff',
    })
  }
}

const enqueueAssetDelete = async (request: Request, env: Env) => {
  if (request.method !== 'POST') {
    return errorResponse('method_not_allowed', 'Method not allowed.', 405, {
      allow: 'POST',
    })
  }

  const authErrorStatus = await authorizeInternalRequest(
    request,
    env,
    ASSETS_HUB_INTERNAL_SCOPE.assetDelete,
  )
  if (authErrorStatus) {
    const forbidden = authErrorStatus === 403
    return errorResponse(
      forbidden ? 'service_scope_forbidden' : 'service_auth_required',
      forbidden
        ? 'The service identity does not grant this operation.'
        : 'A scoped service identity is required.',
      authErrorStatus,
    )
  }

  const message = normalizeDeleteMessage(await parseJsonBody(request))
  if (!message) {
    return errorResponse('invalid_asset_delete_request', 'Asset delete request is invalid.', 400)
  }

  await env.ASSET_DELETE_QUEUE.send(message)

  console.info('[assets-hub] asset_delete_enqueued', {
    assetId: message.assetId,
    assetPublicRef: message.assetPublicRef,
    communityId: message.communityId,
    storageKey: message.storageKey,
  })

  return json({ ok: true, result: { enqueued: true } })
}

const consumeAssetDeletes = async (batch: MessageBatch<unknown>, env: Env) => {
  const validMessages: TAssetDeleteMessage[] = []

  for (const message of batch.messages) {
    const body = normalizeDeleteMessage(message.body)
    if (!body) {
      console.warn('[assets-hub] asset_delete_message_invalid', { body: message.body })
      continue
    }

    validMessages.push(body)
  }

  if (validMessages.length === 0) return

  await env.ASSETS_BUCKET.delete([...new Set(validMessages.map((message) => message.storageKey))])

  for (const message of validMessages) {
    console.info('[assets-hub] asset_object_deleted', {
      assetId: message.assetId,
      assetPublicRef: message.assetPublicRef,
      communityId: message.communityId,
      storageKey: message.storageKey,
    })
  }
}

export default {
  fetch(request: Request, env: Env) {
    const url = new URL(request.url)

    if (url.pathname === '/health') {
      return healthResponse({ env })
    }

    if (url.pathname === '/health/ready') {
      return serviceAuthContractProbe(env).then((check) =>
        healthResponse({
          env,
          checks: [{ name: 'assets-service-auth', ...check }],
          status: check.status,
        }),
      )
    }

    if (url.pathname === '/internal/assets/delete') return enqueueAssetDelete(request, env)

    const reviewImageMatch = url.pathname.match(/^\/review\/([^/]+)$/)
    if (reviewImageMatch) return serveReviewImage(request, env, reviewImageMatch[1]!)

    if (url.pathname === '/generated-batches' || url.pathname.startsWith('/generated-batches/')) {
      return handleGeneratedBatchRequest(request, env)
    }

    if (url.pathname.startsWith('/a/') && request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'access-control-allow-headers': 'content-type',
          'access-control-allow-methods': 'GET, HEAD, OPTIONS',
          ...corsHeaders,
        },
        status: 204,
      })
    }

    if (url.pathname.startsWith('/a/') && !['GET', 'HEAD'].includes(request.method)) {
      return errorResponse('method_not_allowed', 'Method not allowed.', 405, {
        allow: 'GET, HEAD, OPTIONS',
        ...corsHeaders,
      })
    }

    if (url.pathname.startsWith('/a/')) return serveAsset(request, env)

    return errorResponse('not_found', 'Not found.', 404)
  },

  queue(batch: MessageBatch<unknown>, env: Env) {
    return consumeAssetDeletes(batch, env)
  },
}

export { GeneratedImageBatchDO }
