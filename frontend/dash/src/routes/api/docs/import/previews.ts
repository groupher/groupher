import { proxyContentImportRequest } from '@dash/server/content-import'
import { createFileRoute } from '@tanstack/react-router'

import { getPhoenixToken } from '~/app/phoenix-token'

export const Route = createFileRoute('/api/docs/import/previews')({
  server: {
    handlers: {
      POST: ({ request }) => {
        const backendToken = getPhoenixToken(request)
        if (!backendToken) return Response.json({ ok: false }, { status: 401 })
        return proxyContentImportRequest(request, { backendToken })
      },
    },
  },
})
