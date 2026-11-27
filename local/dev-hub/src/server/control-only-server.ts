import { serve } from '@hono/node-server'

import { createControlOnlyApp } from './control-only.ts'
import { verifyStartingRun } from './environment-registry.ts'
import { resolveCheckout } from './worktree-identity.ts'

/** Verify the startup reservation before binding the isolated control API. */
export async function startControlOnly(
  repoRoot: string,
  directory: string,
  instanceId: string,
  port: number,
) {
  if (!instanceId || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('A registered Hub instance and port are required.')
  }
  const identity = await resolveCheckout(repoRoot)
  const environment = await verifyStartingRun(directory, identity, instanceId, port, 'control-only')
  const app = createControlOnlyApp(
    {
      repoRoot: identity.root,
      apiOrigin: `http://127.0.0.1:${port}`,
      instanceId,
      role: environment.role,
      mode: 'control-only',
      apiVersion: 1,
    },
    () => server.close(),
  )
  let ready = false
  const server = serve({
    fetch: (request, context) =>
      ready ? app.fetch(request, context) : new Response('Starting', { status: 503 }),
    hostname: '127.0.0.1',
    port,
  })
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve)
      server.once('error', reject)
    })
    await verifyStartingRun(directory, identity, instanceId, port, 'control-only')
    ready = true
  } catch (error) {
    server.close()
    throw error
  }
  return server
}
