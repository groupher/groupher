import type { Register } from '@tanstack/react-router'
import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import type { RequestHandler } from '@tanstack/react-start/server'

// TanStack Start server entry used by the production Node runtime.
const fetch = createStartHandler(defaultStreamHandler)

type ServerEntry = {
  fetch: RequestHandler<Register>
}

function createServerEntry(entry: ServerEntry): ServerEntry {
  return {
    async fetch(...args) {
      return await entry.fetch(...args)
    },
  }
}

export default createServerEntry({ fetch })
