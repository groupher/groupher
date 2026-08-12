/**
 * Authenticated HTTP boundary for the single explicit Docs import confirmation.
 *
 * Request -> session token -> apply handler -> Workflow
 *
 * @see docs/bulk-import/content-import-architecture.md
 */
import { getPhoenixToken } from '~/app/phoenix-token'

import { proxyContentImportRequest } from '../../../contentImportProxy'

/** Confirms a ready Preview and dispatches its persistent Job workflow. */
export const POST = async (
  request: Request,
  _context: { params: Promise<{ previewRef: string }> },
): Promise<Response> => {
  const backendToken = getPhoenixToken(request)
  if (!backendToken) return Response.json({ ok: false }, { status: 401 })
  return proxyContentImportRequest(request, { backendToken })
}
