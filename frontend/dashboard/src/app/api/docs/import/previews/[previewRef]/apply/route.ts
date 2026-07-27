/**
 * Authenticated HTTP boundary for the single explicit Docs import confirmation.
 *
 * Request -> session token -> stable owner ref -> apply handler -> Workflow
 *
 * @see docs/bulk-import/content-import-architecture.md
 */
import { createHash } from 'node:crypto'

import { getPhoenixToken } from '~/app/phoenix-token'

import { proxyContentImportRequest } from '../../../contentImportProxy'

/** Confirms a ready Preview and dispatches its persistent Job workflow. */
export const POST = async (
  request: Request,
  context: { params: Promise<{ previewRef: string }> },
): Promise<Response> => {
  const backendToken = getPhoenixToken(request)
  if (!backendToken) return Response.json({ ok: false }, { status: 401 })
  const userRef = createHash('sha256').update(backendToken).digest('base64url').slice(0, 32)
  return proxyContentImportRequest(request, { backendToken, userRef })
}
