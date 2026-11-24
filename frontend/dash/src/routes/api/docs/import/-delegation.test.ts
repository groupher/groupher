import { proxyContentImportRequest } from '@dash/server/content-import'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { readPhoenixTokenCookie } from '~/app/phoenix-token'

import { Route as documentRoute } from '../../artiment/import'
import { Route as previewRoute } from './previews'
import { Route as lifecycleRoute } from './previews/$previewRef'
import { Route as applyRoute } from './previews/$previewRef/apply'

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (configuration: unknown) => configuration,
}))
vi.mock('~/app/phoenix-token', () => ({ readPhoenixTokenCookie: vi.fn() }))
vi.mock('@dash/server/content-import', () => ({ proxyContentImportRequest: vi.fn() }))

type RouteHandlers = {
  server: {
    handlers: Record<string, (context: { request: Request }) => Promise<Response> | Response>
  }
}

const routes = [
  ['document', documentRoute],
  ['preview', previewRoute],
  ['lifecycle', lifecycleRoute],
  ['apply', applyRoute],
] as const

describe('Import routes delegate user verification to Phoenix', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(proxyContentImportRequest).mockResolvedValue(new Response(null, { status: 200 }))
  })

  for (const [name, route] of routes) {
    for (const [method, handler] of Object.entries(
      (route as unknown as RouteHandlers).server.handlers,
    )) {
      it(`${name} ${method} forwards an opaque cookie without the Phoenix signing key`, async () => {
        vi.mocked(readPhoenixTokenCookie).mockReturnValue('opaque-user-token')
        const request = new Request('https://dash.groupher.com/api/docs/import/previews', {
          method,
        })
        expect((await handler({ request })).status).toBe(200)
        expect(proxyContentImportRequest).toHaveBeenCalledWith(request, {
          backendToken: 'opaque-user-token',
        })
      })

      it(`${name} ${method} rejects a missing user cookie`, async () => {
        vi.mocked(readPhoenixTokenCookie).mockReturnValue(null)
        const request = new Request('https://dash.groupher.com/api/docs/import/previews', {
          method,
        })
        expect((await handler({ request })).status).toBe(401)
        expect(proxyContentImportRequest).not.toHaveBeenCalled()
      })
    }
  }
})
