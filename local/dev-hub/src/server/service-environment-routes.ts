import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { HTTPException } from 'hono/http-exception'

import { ServiceConfigError } from './config-reader.ts'
import { LocalEnvironmentError } from './local-environment.ts'
import type { ServiceEnvironmentStore } from './service-environment.ts'

/** Mounted behind the Hub's existing loopback Host and Origin guards. */
export function serviceEnvironmentRoutes(store: ServiceEnvironmentStore) {
  const app = new Hono()
  app.onError((error, context) => {
    if (error instanceof HTTPException) return context.json({ error: error.message }, error.status)
    if (error instanceof SyntaxError)
      return context.json({ error: 'Invalid local configuration JSON.' }, 400)
    if (error instanceof ServiceConfigError)
      return context.json({ error: error.message }, error.statusCode)
    if (error instanceof LocalEnvironmentError) return context.json({ error: error.message }, 409)
    return context.json({ error: 'Could not access local configuration.' }, 500)
  })
  app.get('/:id/environment', async (context) =>
    context.json(await store.get(context.req.param('id'))),
  )
  app.patch('/:id/environment', bodyLimit({ maxSize: 64 * 1024 }), async (context) => {
    const body = await context.req.json()
    return context.json(await store.update(context.req.param('id'), body?.changes))
  })
  return app
}
