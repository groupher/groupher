/**
 * Authenticated HTTP entry point for starting Docs Preview analysis.
 *
 * Request -> session token -> content-import service
 *
 * @see docs/bulk-import/content-import-architecture.md
 */
import { getPhoenixToken } from '~/app/phoenix-token'

import { proxyContentImportRequest } from '../contentImportProxy'

/** Authenticates the caller and creates or resumes an idempotent Preview. */
export const POST = async (request: Request): Promise<Response> => {
  const backendToken = getPhoenixToken(request)
  if (!backendToken) return Response.json({ ok: false }, { status: 401 })
  return proxyContentImportRequest(request, { backendToken })
}
