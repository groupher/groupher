import { buildCommunityHealth } from '@community/server/health'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/health')({
  server: {
    handlers: {
      GET: () => Response.json(buildCommunityHealth()),
    },
  },
})
