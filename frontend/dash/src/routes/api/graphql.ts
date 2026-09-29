import { createFileRoute } from '@tanstack/react-router'

import { proxyGraphQLRequest } from '~/graphql/proxy'

export const Route = createFileRoute('/api/graphql')({
  server: {
    handlers: {
      GET: ({ request }) => proxyGraphQLRequest(request),
      POST: ({ request }) => proxyGraphQLRequest(request),
    },
  },
})
