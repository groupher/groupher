import { purgeCommunityTags } from '@community/server/revalidation'
import { createFileRoute } from '@tanstack/react-router'

const TAG_PATTERN = /^community\[[A-Za-z0-9][A-Za-z0-9-]*\](?:-[A-Za-z0-9\x5b\x5d-]+)?$/
const MAX_TAGS = 20

const json = (body: Record<string, unknown>, status = 200): Response =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })

const configuredSecret = (): string | null => {
  const secret = process.env.COMMUNITY_REVALIDATE_SECRET
  return secret?.trim() || null
}

const sameSecret = (request: Request): boolean => {
  const secret = configuredSecret()
  const authorization = request.headers.get('authorization')
  return Boolean(secret && authorization === `Bearer ${secret}`)
}

export const Route = createFileRoute('/internal/cache/revalidate')({
  server: {
    handlers: {
      GET: () => json({ ok: false, error: 'method_not_allowed' }, 405),
      POST: async ({ request }) => {
        if (!configuredSecret()) return json({ ok: false, error: 'service_not_configured' }, 503)
        if (!sameSecret(request)) return json({ ok: false, error: 'unauthorized' }, 401)

        const payload = (await request.json().catch(() => ({}))) as {
          tags?: unknown
          reason?: unknown
        }
        const tags = Array.isArray(payload.tags)
          ? payload.tags.filter((tag): tag is string => typeof tag === 'string')
          : []
        if (
          tags.length === 0 ||
          tags.length > MAX_TAGS ||
          tags.some((tag) => !TAG_PATTERN.test(tag))
        ) {
          return json({ ok: false, error: 'invalid_tags' }, 400)
        }

        try {
          await purgeCommunityTags(tags)
          console.info('[community-revalidate]', {
            tags,
            reason: typeof payload.reason === 'string' ? payload.reason : 'unspecified',
          })
          return json({ ok: true, purged: true, tags })
        } catch (error) {
          console.error('[community-revalidate] purge failed', error)
          return json({ ok: false, error: 'purge_failed' }, 502)
        }
      },
    },
  },
})
