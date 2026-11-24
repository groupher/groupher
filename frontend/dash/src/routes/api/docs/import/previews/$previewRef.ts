import { proxyContentImportRequest } from '@dash/server/content-import'
import { createFileRoute } from '@tanstack/react-router'

import { readPhoenixTokenCookie } from '~/app/phoenix-token'

const proxyAuthenticatedRequest = (request: Request): Promise<Response> | Response => {
  const backendToken = readPhoenixTokenCookie(request)
  if (!backendToken) return Response.json({ ok: false }, { status: 401 })
  return proxyContentImportRequest(request, { backendToken })
}

export const Route = createFileRoute('/api/docs/import/previews/$previewRef')({
  server: {
    handlers: {
      DELETE: ({ request }) => proxyAuthenticatedRequest(request),
      GET: ({ request }) => proxyAuthenticatedRequest(request),
    },
  },
})
