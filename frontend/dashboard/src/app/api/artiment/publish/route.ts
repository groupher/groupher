/**
 * Authenticated route adapter for the shared Node BodyBag publisher.
 *
 * @see docs/bulk-import/article-publish-import-refactor.md
 */
import { getPhoenixToken } from '~/app/phoenix-token'

import { handleArtimentPublishRequest } from '../../../../lib/artiment-publisher/http'

const unauthorizedResponse = (): Response =>
  Response.json(
    { error: { code: 'unauthorized', message: 'Authentication is required.' }, ok: false },
    {
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
      status: 401,
    },
  )

/** Supplies user authorization and server trust to the allowlisted publish handler. */
export const POST = async (request: Request): Promise<Response> => {
  const phoenixToken = getPhoenixToken(request)

  if (!phoenixToken) return unauthorizedResponse()

  const serverTrustSecret = process.env.GROUPHER_SERVER_TRUST_SECRET?.trim()
  if (!serverTrustSecret) {
    return Response.json(
      {
        error: {
          code: 'server_trust_not_configured',
          message: 'Groupher server trust is not configured.',
        },
        ok: false,
      },
      { status: 500 },
    )
  }

  return handleArtimentPublishRequest(request, {
    backendToken: phoenixToken,
    serverTrustSecret,
  })
}
