/**
 * Authenticated HTTP boundary for reading or cancelling one owned Docs Preview.
 *
 * Request -> session token -> owner check -> read/cancel handler
 *
 * @see docs/bulk-import/content-import-architecture.md
 */
import { createHash } from 'node:crypto'

import { getPhoenixToken } from '~/app/phoenix-token'

import { proxyContentImportRequest } from '../../contentImportProxy'

/** Returns the current recoverable Preview projection for its owner. */
export const GET = async (
  request: Request,
  context: { params: Promise<{ previewRef: string }> },
): Promise<Response> => {
  const backendToken = getPhoenixToken(request)
  if (!backendToken) return Response.json({ ok: false }, { status: 401 })
  const userRef = createHash('sha256').update(backendToken).digest('base64url').slice(0, 32)
  return proxyContentImportRequest(request, { backendToken, userRef })
}

/** Cancels Preview work and removes owner-scoped artifacts through the shared handler. */
export const DELETE = async (
  request: Request,
  context: { params: Promise<{ previewRef: string }> },
): Promise<Response> => {
  const backendToken = getPhoenixToken(request)
  if (!backendToken) return Response.json({ ok: false }, { status: 401 })
  const userRef = createHash('sha256').update(backendToken).digest('base64url').slice(0, 32)
  return proxyContentImportRequest(request, { backendToken, userRef })
}
