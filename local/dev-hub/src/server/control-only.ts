import { Hono } from 'hono'

import {
  buildHubHostAllowlist,
  isAllowedHubHost,
  isAllowedRequestOrigin,
} from './request-guards.ts'
import { SERVICE_DEFINITIONS, SERVICE_RELATIONS } from './services.ts'

export type TControlIdentity = {
  repoRoot: string
  apiOrigin: string
  instanceId: string
  role: 'primary' | 'secondary'
  mode: 'control-only'
  apiVersion: 1
}

/** Build a control-only API without creating a service manager or touching Portless. */
export function createControlOnlyApp(identity: TControlIdentity, shutdown: () => void): Hono {
  const app = new Hono()
  const port = Number(new URL(identity.apiOrigin).port)
  const hosts = buildHubHostAllowlist(port, port)
  const origins = new Set([identity.apiOrigin, `http://localhost:${port}`])

  app.use('*', async (context, next) => {
    if (
      !isAllowedHubHost(context.req.header('host'), hosts) ||
      !isAllowedRequestOrigin(context.req.header('origin'), origins)
    ) {
      return context.json({ error: 'Host or origin is not allowed.' }, 403)
    }
    const permitted =
      (context.req.method === 'GET' &&
        ['/api/identity', '/api/services'].includes(context.req.path)) ||
      (context.req.method === 'POST' && context.req.path === '/api/shutdown')
    if (!permitted)
      return context.json({ error: 'Operation unavailable in control-only mode.' }, 403)
    if (
      context.req.method === 'POST' &&
      context.req.header('x-groupher-instance-id') !== identity.instanceId
    ) {
      return context.json({ error: 'Hub instance identity mismatch.' }, 409)
    }
    await next()
  })

  app.get('/api/identity', (context) => context.json(identity))
  app.get('/api/services', (context) =>
    context.json({
      mode: 'control-only',
      services: SERVICE_DEFINITIONS.map((definition) => ({
        id: definition.id,
        name: definition.name,
        description: definition.description,
        group: definition.group,
        monogram: definition.monogram,
        technologies: definition.technologies ?? null,
        port: null,
        url: null,
        appUrl: null,
        portlessName: null,
        portlessUrl: null,
        portlessAppUrl: null,
        endpoints: [],
        status: 'unavailable',
        pid: null,
        startedAt: null,
        endedAt: null,
        exitCode: null,
        externalProcess: null,
        canStart: false,
        unavailableReason: 'Control-only instance has not started product services.',
        metricThresholds: definition.metrics,
        startPolicy: {
          defaultMode: definition.startPolicy?.defaultMode ?? 'self',
          requiredDependencies: definition.startPolicy?.requiredDependencies ?? [],
          optionalDependencies: definition.startPolicy?.optionalDependencies ?? [],
        },
      })),
      relations: SERVICE_RELATIONS,
      metrics: {},
      metricNotices: [],
    }),
  )
  app.post('/api/shutdown', (context) => {
    queueMicrotask(shutdown)
    return context.json({ shutdown: 'complete' })
  })
  return app
}
