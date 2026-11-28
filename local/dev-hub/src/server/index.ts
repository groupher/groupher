import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono, type Context } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'

import type {
  TBrowserMetricReport,
  TGitDiffScope,
  THubEvent,
  THubSnapshot,
  TMetricRange,
  TServiceStartMode,
} from '../shared/contracts.ts'
import {
  buildBrowserOriginsByService,
  collectBrowserOrigins,
  isBrowserMetricOriginAllowed,
} from './browser-origins.ts'
import { ServiceConfigError, ServiceConfigReader } from './config-reader.ts'
import { verifyManagedDatabase } from './database-ready.ts'
import { verifyStartingRun, readRegisteredRun } from './environment-registry.ts'
import { GitMonitor, GitMonitorError } from './git-monitor.ts'
import { embedPageIdentity } from './page-identity.ts'
import {
  ISOLATED_CORE_SERVICE_IDS,
  isolatedServiceDefinitions,
} from './isolated-service-definitions.ts'
import { prepareLocalEnvironment } from './local-environment.ts'
import { cleanAbandonedBrowserRuns } from './local-test-browser.ts'
import { MetricsStore } from './metrics-store.ts'
import { PortlessManager } from './portless.ts'
import { ServiceManager, ServiceManagerError } from './process-manager.ts'
import { ProcessMetricsMonitor } from './process-metrics-monitor.ts'
import {
  buildHubHostAllowlist,
  isAllowedHubHost,
  isAllowedRequestOrigin,
  isAllowedInstanceMutation,
} from './request-guards.ts'
import { serviceEnvironmentRoutes } from './service-environment-routes.ts'
import { ServiceEnvironmentStore } from './service-environment.ts'
import { REPO_ROOT, SERVICE_DEFINITIONS, SERVICE_RELATIONS } from './services.ts'
import { registryRoot, userDataRoot } from './storage-paths.ts'
import { resolveCheckout } from './worktree-identity.ts'

const host = '127.0.0.1'
const port = Number.parseInt(process.env.DEV_HUB_PORT || '4310', 10)
const webPort = Number.parseInt(process.env.DEV_HUB_WEB_PORT || String(port), 10)
const origin = `http://${host}:${port}`
const webOrigin = `http://${host}:${webPort}`
const apiOnly = process.env.DEV_HUB_API_ONLY === 'true'
const devHubRoot = fileURLToPath(new URL('../../', import.meta.url))
const clientRoot = path.join(devHubRoot, 'dist/client')
const indexHtmlPath = path.join(clientRoot, 'index.html')
const metricsRoot = path.join(userDataRoot(REPO_ROOT), 'metrics')
const hubOrigins = new Set([
  origin,
  webOrigin,
  `http://localhost:${port}`,
  `http://localhost:${webPort}`,
])
const instanceId = process.env.DEV_HUB_INSTANCE_ID
const managedIdentity = instanceId
  ? await (async () => {
      const checkout = await resolveCheckout(REPO_ROOT)
      const environment = await verifyStartingRun(
        registryRoot(),
        checkout,
        instanceId,
        port,
        'full',
      )
      return {
        repoRoot: checkout.root,
        apiOrigin: origin,
        instanceId,
        role: environment.role,
        mode: 'full',
        apiVersion: 1,
      }
    })()
  : null

let serviceDefinitions = SERVICE_DEFINITIONS
if (managedIdentity?.role === 'secondary') {
  const checkout = await resolveCheckout(REPO_ROOT)
  const run = await readRegisteredRun(registryRoot(), checkout)
  if (!run?.servicePorts) throw new Error('Secondary service ports are not reserved.')
  const database = await verifyManagedDatabase(REPO_ROOT, 'dev')
  await verifyManagedDatabase(REPO_ROOT, 'test')
  serviceDefinitions = isolatedServiceDefinitions(
    SERVICE_DEFINITIONS,
    (await verifyStartingRun(registryRoot(), checkout, instanceId!, port, 'full')).slug,
    run.servicePorts,
    database,
  ).map((service) =>
    ISOLATED_CORE_SERVICE_IDS.has(service.id)
      ? service
      : {
          ...service,
          command: undefined,
          unavailableReason: 'This service is not yet enabled for secondary environments.',
        },
  )
}
const browserOriginsByService = buildBrowserOriginsByService(serviceDefinitions)
const browserOrigins = collectBrowserOrigins(browserOriginsByService)
const hubHosts = buildHubHostAllowlist(port, webPort)
const serviceIds = new Set(serviceDefinitions.map((definition) => definition.id))
const portless = new PortlessManager(
  managedIdentity?.role === 'secondary'
    ? serviceDefinitions.filter((definition) => definition.command)
    : serviceDefinitions,
  undefined,
  registryRoot(),
  managedIdentity?.role === 'secondary',
)
console.info('Checking Portless HTTPS proxy and canonical aliases…')
await portless.ensure()
const manager = new ServiceManager(
  serviceDefinitions,
  origin,
  undefined,
  undefined,
  undefined,
  async () => {
    await portless.ensure()
    return prepareLocalEnvironment()
  },
  REPO_ROOT,
)
const configReader = new ServiceConfigReader(serviceDefinitions)
const environmentStore = new ServiceEnvironmentStore(serviceDefinitions)
const gitMonitor = new GitMonitor(REPO_ROOT)
const metricsStore = new MetricsStore(metricsRoot, serviceDefinitions)
await Promise.all([
  manager.initialize(),
  gitMonitor.initialize(),
  metricsStore.initialize(),
  cleanAbandonedBrowserRuns().catch((error) => {
    console.error('Could not clean abandoned test browsers.', error)
  }),
])
const processMetricsMonitor = new ProcessMetricsMonitor(manager, metricsStore)
processMetricsMonitor.start()

const app = new Hono()

app.use('*', async (context, next) => {
  if (!isAllowedHubHost(context.req.header('host'), hubHosts)) {
    return context.json({ error: 'Host is not allowed.' }, 403)
  }
  await next()
})

app.use(
  '/api/browser-metrics',
  cors({
    origin: (requestOrigin) => (browserOrigins.has(requestOrigin) ? requestOrigin : null),
    allowHeaders: ['Content-Type', 'X-Groupher-Instance-Id'],
    allowMethods: ['POST', 'OPTIONS'],
    maxAge: 86_400,
  }),
)

app.use(
  '/api/identity',
  cors({
    origin: (requestOrigin) => (browserOrigins.has(requestOrigin) ? requestOrigin : null),
    allowMethods: ['GET', 'OPTIONS'],
  }),
)

app.use('/api/*', async (context, next) => {
  const requestOrigin = context.req.header('origin')
  const allowed =
    context.req.path === '/api/browser-metrics'
      ? browserOrigins
      : context.req.path === '/api/identity'
        ? new Set([...browserOrigins, ...hubOrigins])
        : hubOrigins
  if (!isAllowedRequestOrigin(requestOrigin, allowed)) {
    return context.json({ error: 'Cross-origin Dev Hub access is not allowed.' }, 403)
  }
  if (
    !isAllowedInstanceMutation(
      context.req.method,
      managedIdentity?.instanceId,
      context.req.header('x-groupher-instance-id'),
    )
  ) {
    return context.json({ error: 'Hub instance identity mismatch.' }, 409)
  }
  await next()
})

app.get('/api/identity', (context) =>
  context.json(managedIdentity || { repoRoot: REPO_ROOT, apiOrigin: origin }),
)

app.post('/api/environment/ensure', async (context) => {
  try {
    await portless.ensure()
    return context.json({ ready: true })
  } catch (error) {
    return respondWithError(context, error)
  }
})

app.post('/api/browser-metrics', async (context) => {
  const requestOrigin = context.req.header('origin')
  if (!requestOrigin) return context.json({ error: 'Browser metric origin is required.' }, 403)

  try {
    const report = parseBrowserMetricReport(await context.req.json())
    if (
      !isBrowserMetricOriginAllowed({
        originsByService: browserOriginsByService,
        serviceId: report.serviceId,
        requestOrigin,
        reportUrl: report.url,
      })
    ) {
      return context.json({ error: 'Browser metric origin does not match the service.' }, 403)
    }

    await metricsStore.recordBrowser(report)
    return context.body(null, 204)
  } catch (error) {
    return context.json(
      { error: error instanceof Error ? error.message : 'Invalid browser metric report.' },
      400,
    )
  }
})

app.get('/api/services', (context) => {
  return context.json<THubSnapshot>({
    services: manager.listServices(),
    relations: SERVICE_RELATIONS,
    git: gitMonitor.getSnapshot(),
    metrics: metricsStore.getSnapshots(),
    metricNotices: metricsStore.getNotices(),
  })
})

app.get('/api/git/diff', async (context) => {
  const scope = context.req.query('scope')
  if (!isGitDiffScope(scope)) return context.json({ error: 'Unknown Git diff scope.' }, 400)

  try {
    return context.json(await gitMonitor.getPatch(scope))
  } catch (error) {
    return respondWithError(context, error)
  }
})

app.get('/api/services/:id/logs', (context) => {
  try {
    return context.json({ logs: manager.getLogs(context.req.param('id')) })
  } catch (error) {
    return respondWithError(context, error)
  }
})

app.route('/api/services', serviceEnvironmentRoutes(environmentStore))

app.get('/api/services/:id/config', async (context) => {
  try {
    return context.json(await configReader.getManifest(context.req.param('id')))
  } catch (error) {
    return respondWithError(context, error)
  }
})

app.get('/api/services/:id/config/:fileId', async (context) => {
  try {
    return context.json(
      await configReader.getContent(context.req.param('id'), context.req.param('fileId')),
    )
  } catch (error) {
    return respondWithError(context, error)
  }
})

app.get('/api/services/:id/metrics', async (context) => {
  const serviceId = context.req.param('id')
  const range = context.req.query('range')
  const resolution = Number.parseInt(context.req.query('resolution') || '800', 10)
  if (!serviceIds.has(serviceId))
    return context.json({ error: `Unknown service: ${serviceId}` }, 404)
  if (!isMetricRange(range)) return context.json({ error: 'Unknown metric range.' }, 400)

  try {
    return context.json(await metricsStore.getHistory(serviceId, range, resolution))
  } catch (error) {
    return respondWithError(context, error)
  }
})

app.post('/api/services/:id/start', async (context) => {
  try {
    const mode = await readStartMode(context)
    const services = await manager.startWithMode(context.req.param('id'), mode)
    return context.json({ service: services[services.length - 1], services })
  } catch (error) {
    return respondWithError(context, error)
  }
})

app.post('/api/services/:id/stop', async (context) => {
  try {
    return context.json({ service: await manager.stop(context.req.param('id')) })
  } catch (error) {
    return respondWithError(context, error)
  }
})

app.post('/api/services/:id/restart', async (context) => {
  try {
    return context.json({ service: await manager.restart(context.req.param('id')) })
  } catch (error) {
    return respondWithError(context, error)
  }
})

app.get('/api/events', (context) => {
  return streamSSE(context, async (stream) => {
    let writeQueue = Promise.resolve()
    let eventSeq = 0
    const writeEvent = (event: THubEvent): Promise<void> => {
      writeQueue = writeQueue
        .then(() =>
          stream.writeSSE({
            id: String(++eventSeq),
            event: event.type,
            data: JSON.stringify(event),
          }),
        )
        .catch(() => undefined)
      return writeQueue
    }

    const unsubscribe = manager.subscribe((event) => {
      void writeEvent(event)
    })
    const unsubscribeGit = gitMonitor.subscribe((git) => {
      void writeEvent({ type: 'git', git })
    })
    const unsubscribeMetrics = metricsStore.subscribe((event) => {
      void writeEvent(event)
    })

    try {
      await stream.writeSSE({
        event: 'snapshot',
        data: JSON.stringify({
          services: manager.listServices(),
          relations: SERVICE_RELATIONS,
          git: gitMonitor.getSnapshot(),
          metrics: metricsStore.getSnapshots(),
          metricNotices: metricsStore.getNotices(),
        } satisfies THubSnapshot),
      })

      while (!stream.aborted) {
        await stream.sleep(15_000)
        if (!stream.aborted) await stream.writeSSE({ event: 'ping', data: String(Date.now()) })
      }
    } finally {
      unsubscribe()
      unsubscribeGit()
      unsubscribeMetrics()
      await writeQueue
    }
  })
})

if (!apiOnly) {
  app.use('/assets/*', serveStatic({ root: clientRoot }))
  const template = await readFile(indexHtmlPath, 'utf8')
  const indexHtml = managedIdentity ? embedPageIdentity(template, managedIdentity) : template
  app.get('*', (context) => {
    context.header('Cache-Control', 'no-store')
    return context.html(indexHtml)
  })
}

if (managedIdentity) {
  await verifyStartingRun(
    registryRoot(),
    await resolveCheckout(REPO_ROOT),
    managedIdentity.instanceId,
    port,
    'full',
  )
}
const server = serve({ fetch: app.fetch, hostname: host, port })
console.log(`\u001b[38;5;75mDev Hub is ready at ${origin}\u001b[0m`)

if (!apiOnly && process.env.DEV_HUB_OPEN_BROWSER !== 'false') {
  const browserCommand = process.platform === 'darwin' ? 'open' : 'xdg-open'
  const opener = spawn(browserCommand, [origin], { detached: true, stdio: 'ignore' })
  opener.unref()
}

let shutdownPreparation: Promise<void> | null = null
let exitScheduled = false

const prepareShutdown = (): Promise<void> => {
  if (shutdownPreparation) return shutdownPreparation

  shutdownPreparation = (async () => {
    processMetricsMonitor.close()
    gitMonitor.close()
    await manager.shutdown()
    await metricsStore.close()
  })()
  return shutdownPreparation
}

const finishShutdown = () => {
  if (exitScheduled) return
  exitScheduled = true
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 1_500).unref()
}

const shutdown = async (signal: NodeJS.Signals) => {
  console.warn(`Dev Hub received ${signal}; stopping managed services.`)
  await prepareShutdown()
  finishShutdown()
}

app.post('/api/shutdown', async (context) => {
  console.info('Dev Hub shutdown requested through /api/shutdown.')
  await prepareShutdown()
  setTimeout(finishShutdown, 0).unref()
  return context.json({ shutdown: 'complete' })
})

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
if (process.platform !== 'win32') process.on('SIGHUP', () => void shutdown('SIGHUP'))

function respondWithError(context: Context, error: unknown) {
  if (
    error instanceof ServiceManagerError ||
    error instanceof ServiceConfigError ||
    error instanceof GitMonitorError
  ) {
    return context.json({ error: error.message }, error.statusCode)
  }

  console.error(error)
  return context.json({ error: 'Unexpected Dev Hub error.' }, 500)
}

function isGitDiffScope(value: string | undefined): value is TGitDiffScope {
  return value === 'all' || value === 'staged' || value === 'unstaged'
}

function isMetricRange(value: string | undefined): value is TMetricRange {
  return value === '15m' || value === '1h' || value === '6h' || value === '24h'
}

async function readStartMode(context: Context): Promise<TServiceStartMode | 'default'> {
  if (context.req.header('content-type')?.includes('application/json')) {
    const payload = (await context.req.json().catch(() => null)) as { mode?: unknown } | null
    if (isStartMode(payload?.mode)) return payload.mode
  }

  const queryMode = context.req.query('mode')
  return isStartMode(queryMode) ? queryMode : 'default'
}

function isStartMode(value: unknown): value is TServiceStartMode {
  return value === 'self' || value === 'chain' || value === 'related'
}

function parseBrowserMetricReport(value: unknown): TBrowserMetricReport {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Browser metric report must be an object.')
  }

  const report = value as Record<string, unknown>
  const serviceId = validString(report.serviceId, 'serviceId', 80)
  if (!browserOriginsByService.has(serviceId)) throw new Error('Unknown browser metric service.')

  const pageId = validString(report.pageId, 'pageId', 120)
  const url = validString(report.url, 'url', 2_048)
  const visibility = report.visibility
  if (visibility !== 'visible' && visibility !== 'hidden') {
    throw new Error('visibility must be visible or hidden.')
  }

  const heapBytes = validNullableNumber(report.heapBytes, 'heapBytes', 0, 64 * 1024 ** 3)
  const busyPercent = validNullableNumber(report.busyPercent, 'busyPercent', 0, 100)
  const sampleWindowMs = validNumber(report.sampleWindowMs, 'sampleWindowMs', 100, 60_000)

  try {
    new URL(url)
  } catch {
    throw new Error('url must be valid.')
  }

  return {
    serviceId,
    pageId,
    url,
    visibility,
    heapBytes,
    busyPercent,
    sampleWindowMs,
  }
}

function validString(value: unknown, name: string, maxLength: number): string {
  if (typeof value !== 'string' || value.length === 0 || value.length > maxLength) {
    throw new Error(`${name} must be a non-empty string.`)
  }
  return value
}

function validNullableNumber(
  value: unknown,
  name: string,
  min: number,
  max: number,
): number | null {
  if (value === null) return null
  return validNumber(value, name, min, max)
}

function validNumber(value: unknown, name: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name} must be a finite number between ${min} and ${max}.`)
  }
  return value
}
