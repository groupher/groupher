/**
 * Authenticated HTTP boundary for the single explicit Docs import confirmation.
 *
 * Request -> session token -> stable owner ref -> apply handler -> Workflow
 *
 * @see docs/bulk-import/content-import-architecture.md
 */
import { createHash } from 'node:crypto'

import { getPhoenixToken } from '~/app/phoenix-token'

import { handleApplyDocImportPreview } from '../../../../../../../lib/content-import/http'

/** Confirms a ready Preview and dispatches its persistent Job workflow. */
export const POST = async (
  request: Request,
  context: { params: Promise<{ previewRef: string }> },
): Promise<Response> => {
  const backendToken = getPhoenixToken(request)
  if (!backendToken) return Response.json({ ok: false }, { status: 401 })
  const serverTrustSecret = process.env.GROUPHER_SERVER_TRUST_SECRET?.trim()
  const previewSecret = process.env.NEXTAUTH_SECRET?.trim()
  if (!serverTrustSecret || !previewSecret) return Response.json({ ok: false }, { status: 500 })
  const userRef = createHash('sha256').update(backendToken).digest('base64url').slice(0, 32)
  const { previewRef } = await context.params
  return handleApplyDocImportPreview(request, previewRef, {
    backendToken,
    previewSecret,
    serverTrustSecret,
    userRef,
  })
}
