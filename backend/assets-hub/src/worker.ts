import {
  fetchCommunityAssetOriginInfo,
  PhoenixGraphQLError,
  type TCommunityAssetOriginInfo,
} from './phoenix'

type TAssetVariant = 'original' | 'thumbnail' | 'card'

const assetVariants = new Set<TAssetVariant>(['original', 'thumbnail', 'card'])
const originalCacheControl = 'public, max-age=3600'
const noStore = 'no-store'
const supportedStorageProviders = new Set(['r2'])
const corsHeaders = {
  'access-control-allow-origin': '*',
}

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

const serveAsset = async (request: Request, env: Env) => {
  const url = new URL(request.url)
  const assetPath = parseAssetPath(url.pathname)
  if (!assetPath) return errorResponse('not_found', 'Not found.', 404)

  let originInfo: TCommunityAssetOriginInfo | null
  try {
    originInfo = await fetchCommunityAssetOriginInfo({
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

export default {
  fetch(request: Request, env: Env) {
    const url = new URL(request.url)

    if (url.pathname === '/health') {
      return json({
        ok: true,
        schemaVersion: 'health.v1',
        service: 'assets-hub',
        status: 'ok',
        target: 'cloudflare-worker',
      })
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
}
