import { createFileRoute } from '@tanstack/react-router'

import { getPhoenixToken } from '~/app/phoenix-token'
import { CACHE_TAG } from '~/const/cache'

const json = (body: Record<string, unknown>, status = 200): Response =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })

export const Route = createFileRoute('/api/revalidate/community')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const payload = (await request.json().catch(() => ({}))) as { community?: unknown }
        const community = typeof payload.community === 'string' ? payload.community.trim() : ''
        if (!community) return json({ ok: false, error: 'community is required' }, 400)
        if (!getPhoenixToken(request)) return json({ ok: false, error: 'unauthorized' }, 401)

        const endpoint = process.env.COMMUNITY_REVALIDATION_URL?.trim()
        const secret = process.env.COMMUNITY_REVALIDATE_SECRET?.trim()
        if (!endpoint || !secret) return json({ ok: false, error: 'service_not_configured' }, 503)

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${secret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tags: [CACHE_TAG.communityCache(community)],
            reason: 'dashboard.community.update',
          }),
        })
        if (!response.ok) return json({ ok: false, error: 'community_purge_failed' }, 502)
        return json({ ok: true })
      },
    },
  },
})
