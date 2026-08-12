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

/** Supplies user authorization and Dashboard service identity to the allowlisted handler. */
export const POST = async (request: Request): Promise<Response> => {
  const phoenixToken = getPhoenixToken(request)

  if (!phoenixToken) return unauthorizedResponse()

  return handleArtimentPublishRequest(request, {
    backendToken: phoenixToken,
  })
}
