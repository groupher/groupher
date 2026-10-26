import { proxyContentImportRequest } from '@dash/server/content-import'
import { createFileRoute } from '@tanstack/react-router'

import { readPhoenixTokenCookie } from '~/app/phoenix-token'

export const Route = createFileRoute('/api/artiment/import')({
  server: {
    handlers: {
      POST: ({ request }) => {
        const backendToken = readPhoenixTokenCookie(request)
        if (!backendToken) return Response.json({ ok: false }, { status: 401 })
        return proxyContentImportRequest(request, { backendToken })
      },
    },
  },
})
