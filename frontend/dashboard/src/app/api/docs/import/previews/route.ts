/**
 * Authenticated HTTP entry point for starting Docs Preview analysis.
 *
 * Request -> session token -> stable owner ref -> content-import service
 *
 * @see docs/bulk-import/content-import-architecture.md
 */
import { createHash } from 'node:crypto'

import { getPhoenixToken } from '~/app/phoenix-token'

import { proxyContentImportRequest } from '../contentImportProxy'

/** Authenticates the caller and creates or resumes an idempotent Preview. */
export const POST = async (request: Request): Promise<Response> => {
  const backendToken = getPhoenixToken(request)
  if (!backendToken) return Response.json({ ok: false }, { status: 401 })
  const userRef = createHash('sha256').update(backendToken).digest('base64url').slice(0, 32)
  return proxyContentImportRequest(request, { backendToken, userRef })
}
