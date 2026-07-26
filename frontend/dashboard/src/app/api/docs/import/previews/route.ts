/**
 * Authenticated HTTP entry point for starting Docs Preview analysis.
 *
 * Request -> session token -> stable owner ref -> content-import handler
 *
 * @see docs/bulk-import/content-import-architecture.md
 */
import { createHash } from 'node:crypto'

import { getPhoenixToken } from '~/app/phoenix-token'

import { handleCreateDocImportPreview } from '../../../../../lib/content-import/http'

/** Authenticates the caller and creates or resumes an idempotent Preview. */
export const POST = async (request: Request): Promise<Response> => {
  const backendToken = getPhoenixToken(request)
  if (!backendToken) return Response.json({ ok: false }, { status: 401 })
  const serverTrustSecret = process.env.GROUPHER_SERVER_TRUST_SECRET?.trim()
  const previewSecret = process.env.NEXTAUTH_SECRET?.trim()
  if (!serverTrustSecret || !previewSecret) return Response.json({ ok: false }, { status: 500 })
  const userRef = createHash('sha256').update(backendToken).digest('base64url').slice(0, 32)
  return handleCreateDocImportPreview(request, {
    backendToken,
    previewSecret,
    serverTrustSecret,
    userRef,
  })
}
