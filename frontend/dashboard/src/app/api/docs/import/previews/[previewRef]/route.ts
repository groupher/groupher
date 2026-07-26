/**
 * Authenticated HTTP boundary for reading or cancelling one owned Docs Preview.
 *
 * Request -> session token -> owner check -> read/cancel handler
 *
 * @see docs/bulk-import/content-import-architecture.md
 */
import { createHash } from 'node:crypto'

import { getAuthToken } from '~/app/auth-token'
import { AUTH_KEY } from '~/const/oauth'

import {
  handleCancelDocImportPreview,
  handleGetDocImportPreview,
} from '../../../../../../lib/content-import/http'

/** Returns the current recoverable Preview projection for its owner. */
export const GET = async (
  request: Request,
  context: { params: Promise<{ previewRef: string }> },
): Promise<Response> => {
  const token = await getAuthToken(request)
  const backendToken = token?.[AUTH_KEY.TOKEN]
  if (!backendToken) return Response.json({ ok: false }, { status: 401 })
  const serverTrustSecret = process.env.GROUPHER_SERVER_TRUST_SECRET?.trim()
  if (!serverTrustSecret) return Response.json({ ok: false }, { status: 500 })
  const userRef =
    token.sub || createHash('sha256').update(String(backendToken)).digest('base64url').slice(0, 32)
  const { previewRef } = await context.params
  const community = new URL(request.url).searchParams.get('community') || ''
  return handleGetDocImportPreview(previewRef, community, { serverTrustSecret, userRef })
}

/** Cancels Preview work and removes owner-scoped artifacts through the shared handler. */
export const DELETE = async (
  request: Request,
  context: { params: Promise<{ previewRef: string }> },
): Promise<Response> => {
  const token = await getAuthToken(request)
  const backendToken = token?.[AUTH_KEY.TOKEN]
  if (!backendToken) return Response.json({ ok: false }, { status: 401 })
  const serverTrustSecret = process.env.GROUPHER_SERVER_TRUST_SECRET?.trim()
  if (!serverTrustSecret) return Response.json({ ok: false }, { status: 500 })
  const userRef =
    token.sub || createHash('sha256').update(String(backendToken)).digest('base64url').slice(0, 32)
  const { previewRef } = await context.params
  const community = new URL(request.url).searchParams.get('community') || ''
  return handleCancelDocImportPreview(previewRef, community, { serverTrustSecret, userRef })
}
