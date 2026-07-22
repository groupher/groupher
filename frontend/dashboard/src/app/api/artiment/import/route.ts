/**
 * Authenticated route adapter for single-document Import Content.
 *
 * @see docs/bulk-import/article-publish-import-refactor.md
 */
import { getToken } from 'next-auth/jwt'

import { AUTH_KEY } from '~/const/oauth'

import { handleDocumentImportRequest } from '../../../../lib/document-importer/http'

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

/** Authenticates the user before delegating to the bounded document import handler. */
export const POST = async (request: Request): Promise<Response> => {
  const token = await getToken({
    req: request,
    secret: process.env.NEXTAUTH_SECRET,
    raw: false,
  })

  if (!token?.[AUTH_KEY.TOKEN]) return unauthorizedResponse()

  return handleDocumentImportRequest(request)
}
