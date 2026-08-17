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

import { createHealthResponse } from '@groupher/service/health'
import { jsonResponse } from '@groupher/service/http'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

import { verifyCapability, type TUploadCapability } from './capability'
import { completePhoenixUpload } from './phoenix'
import {
  createPresignedGetUrl,
  createPresignedPutUrl,
  getR2ObjectBytes,
  headR2Object,
  smokeR2,
} from './r2'

type TOptions = {
  environment?: Record<string, string | undefined>
}

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
  'http://apply.groupher.localhost',
  'https://apply.groupher.localhost',
  'http://dashboard.groupher.localhost',
  'https://dashboard.groupher.localhost',
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

const objectContentHash = async (capability: TUploadCapability) => {
  if (capability.checksumSha256) return `sha256:${checksumBase64ToHex(capability.checksumSha256)}`

  const buffer = await getR2ObjectBytes(capability.objectKey)
  return sha256Hash(buffer)
}

/** Creates the assets hub application with injectable runtime dependencies. */
export const createApp = ({ environment = process.env }: TOptions = {}) => {
  const app = new Hono()

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

  app.get('/health', (context) => context.json(createHealthResponse({ service: 'assets-hub' })))

  app.post('/uploads', async (context) => {
    try {
      const capability = verifyCapability(await parseCapabilityInput(context), environment)
      const uploadUrl = await createPresignedPutUrl({
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
              ...(capability.checksumSha256
                ? { 'x-amz-checksum-sha256': capability.checksumSha256 }
                : {}),
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

  app.post('/uploads/:uploadRef/finalize', async (context) => {
    const timings: TTiming[] = []

    try {
      const capability = verifyCapability(await parseCapabilityInput(context), environment)
      const uploadRef = context.req.param('uploadRef')
      if (uploadRef !== capability.uploadRef) throw new Error('uploadRef does not match capability')

      const head = await timed('r2Head', timings, () => headR2Object(capability.objectKey))
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

      const contentHash = await timed('contentHash', timings, () => objectContentHash(capability))

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
