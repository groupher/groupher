/**
 * Cron-only cleanup boundary for expired PreviewStore prefixes.
 *
 * Cron secret -> content-import service -> expired prefix deletion
 *
 * @see docs/bulk-import/content-import-architecture.md
 */
const serviceUnavailable = (message: string): Response =>
  Response.json(
    { error: { code: 'content_import_unavailable', message }, ok: false },
    { headers: { 'Cache-Control': 'no-store' }, status: 503 },
  )

const contentImportUrl = (): URL | Response => {
  const value = process.env.CONTENT_IMPORT_APP_ENDPOINT?.trim()
  if (!value) return serviceUnavailable('Content Import endpoint is not configured.')

  try {
    return new URL(value)
  } catch {
    return serviceUnavailable('Content Import endpoint is not configured correctly.')
  }
}

/** Proxies expired Preview cleanup to content-import after validating the cron secret. */
export const POST = async (request: Request): Promise<Response> => {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 })
  }

  const baseUrl = contentImportUrl()
  if (baseUrl instanceof Response) return baseUrl

  return fetch(new URL('/api/internal/docs-import/sweep', baseUrl), {
    cache: 'no-store',
    headers: { Authorization: `Bearer ${secret}` },
    method: 'POST',
  })
}
