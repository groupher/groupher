import { createFileRoute } from '@tanstack/react-router'

import { titleSlugify } from '~/lib/server/slugify-route'

export const Route = createFileRoute('/api/utils/slugify')({
  server: {
    handlers: {
      POST: ({ request }) => titleSlugify(request),
    },
  },
})
