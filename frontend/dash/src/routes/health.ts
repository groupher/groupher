import { createFileRoute } from '@tanstack/react-router'

const SERVICE_ID = 'dash'

export const Route = createFileRoute('/health')({
  server: {
    handlers: {
      GET: () =>
        Response.json({
          schemaVersion: 'health.v1',
          service: SERVICE_ID,
          status: 'ok',
          dependencies: [],
        }),
    },
  },
})
