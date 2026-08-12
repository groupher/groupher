import {
  bearerToken,
  createServiceTokenVerifier,
  serviceTokenErrorStatus,
} from '@groupher/service/auth'

import { dashboardToContentImportHeaders } from '../../../../../lib/serviceIdentity'

/**
 * Cron-only cleanup boundary for expired PreviewStore prefixes.
 *
 * Scheduler service JWT -> Dashboard service JWT -> expired prefix deletion
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

/** Proxies cleanup only for the scoped scheduler service identity. */
export const POST = async (request: Request): Promise<Response> => {
  const token = bearerToken(request.headers.get('authorization') || undefined)
  if (!token) return Response.json({ ok: false }, { status: 401 })
  try {
    const verifier = createServiceTokenVerifier({
      audience: 'dashboard:scheduler-api',
      issuer: process.env.SERVICE_AUTH_ISSUER || 'https://auth.groupher.com',
      jwksUrl:
        process.env.SERVICE_AUTH_JWKS_URL || 'https://auth.groupher.com/.well-known/jwks.json',
    })
    const actor = await verifier.verify(token, 'scheduler:docs-import:sweep')
    if (actor.subject !== 'service:scheduler') {
      return Response.json({ ok: false }, { status: 403 })
    }
  } catch (error) {
    return Response.json({ ok: false }, { status: serviceTokenErrorStatus(error) })
  }

  const baseUrl = contentImportUrl()
  if (baseUrl instanceof Response) return baseUrl

  const headers = await dashboardToContentImportHeaders(null, 'docs:import:sweep')
  return fetch(new URL('/api/internal/docs-import/sweep', baseUrl), {
    cache: 'no-store',
    headers,
    method: 'POST',
  })
}
