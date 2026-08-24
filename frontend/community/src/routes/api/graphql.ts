import { hasConfiguredPurge, observeCommunityTagPurge } from '@community/server/revalidation'
import { createFileRoute } from '@tanstack/react-router'
import { waitUntil } from 'cloudflare:workers'

import { proxyGraphQLRequest } from '~/graphql/proxy'
import { mutationCacheTags } from '~/query/cacheInvalidation'

export const Route = createFileRoute('/api/graphql')({
  server: {
    handlers: {
      GET: ({ request }) => proxyGraphQLRequest(request),
      POST: async ({ request }) => {
        const payload = (await request
          .clone()
          .json()
          .catch(() => null)) as {
          query?: unknown
          variables?: unknown
        } | null
        const response = await proxyGraphQLRequest(request)
        if (response.ok && hasConfiguredPurge() && payload && typeof payload.query === 'string') {
          const result = (await response
            .clone()
            .json()
            .catch(() => null)) as {
            errors?: unknown[]
          } | null
          if (!result?.errors?.length) {
            const variables =
              payload.variables && typeof payload.variables === 'object'
                ? (payload.variables as Record<string, unknown>)
                : {}
            const tags = mutationCacheTags(payload.query, variables)
            if (tags.length > 0) {
              waitUntil(observeCommunityTagPurge(tags))
            }
          }
        }
        return response
      },
    },
  },
})
