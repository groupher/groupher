/**
 * Cron-only cleanup boundary for expired PreviewStore prefixes.
 *
 * Cron secret -> PreviewStore scan -> expired prefix deletion
 *
 * @see docs/bulk-import/content-import-architecture.md
 */
import {
  getPreviewStore,
  sweepExpiredPreviews,
} from '../../../../../lib/content-import/core/preview-store'

/** Deletes expired Preview artifacts after validating the internal cron secret. */
export const POST = async (request: Request): Promise<Response> => {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ ok: false }, { status: 401 })
  }
  const deleted = await sweepExpiredPreviews(getPreviewStore())
  return Response.json({ deleted, ok: true })
}
