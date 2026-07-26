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
} from '../shared/contracts.ts'
import {
  buildBrowserOriginsByService,
  collectBrowserOrigins,
  isBrowserMetricOriginAllowed,
} from './browser-origins.ts'
import { ServiceConfigError, ServiceConfigReader } from './config-reader.ts'
import { GitMonitor, GitMonitorError } from './git-monitor.ts'
import { MetricsStore } from './metrics-store.ts'
import { ServiceManager, ServiceManagerError } from './process-manager.ts'
import { ProcessMetricsMonitor } from './process-metrics-monitor.ts'
import { REPO_ROOT, SERVICE_DEFINITIONS, SERVICE_RELATIONS } from './services.ts'

const host = '127.0.0.1'
const port = Number.parseInt(process.env.DEV_HUB_PORT || '4310', 10)
const webPort = Number.parseInt(process.env.DEV_HUB_WEB_PORT || String(port), 10)
const origin = `http://${host}:${port}`
const webOrigin = `http://${host}:${webPort}`
const apiOnly = process.env.DEV_HUB_API_ONLY === 'true'
const devHubRoot = fileURLToPath(new URL('../../', import.meta.url))
const clientRoot = path.join(devHubRoot, 'dist/client')
const indexHtmlPath = path.join(clientRoot, 'index.html')
const metricsRoot = path.join(devHubRoot, '.data/metrics')
const hubOrigins = new Set([
  origin,
  webOrigin,
  `http://localhost:${port}`,
  `http://localhost:${webPort}`,
])
const browserOriginsByService = buildBrowserOriginsByService(SERVICE_DEFINITIONS)
const browserOrigins = collectBrowserOrigins(browserOriginsByService)
const serviceIds = new Set(SERVICE_DEFINITIONS.map((definition) => definition.id))

const manager = new ServiceManager(SERVICE_DEFINITIONS, origin)
const configReader = new ServiceConfigReader(SERVICE_DEFINITIONS)
const gitMonitor = new GitMonitor(REPO_ROOT)
const metricsStore = new MetricsStore(metricsRoot, SERVICE_DEFINITIONS)
await Promise.all([manager.initialize(), gitMonitor.initialize(), metricsStore.initialize()])
const processMetricsMonitor = new ProcessMetricsMonitor(manager, metricsStore)
processMetricsMonitor.start()

const app = new Hono()

app.use(
  '/api/browser-metrics',
  cors({
    origin: (requestOrigin) => (browserOrigins.has(requestOrigin) ? requestOrigin : null),
    allowHeaders: ['Content-Type'],
    allowMethods: ['POST', 'OPTIONS'],
    maxAge: 86_400,
  }),
)

app.use('/api/*', async (context, next) => {
  if (context.req.method !== 'GET') {
    const requestOrigin = context.req.header('origin')
    const allowed = context.req.path === '/api/browser-metrics' ? browserOrigins : hubOrigins

    if (requestOrigin && !allowed.has(requestOrigin)) {
      return context.json({ error: 'Cross-origin process control is not allowed.' }, 403)
    }
  }

  await next()
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
      await configReader.getContent(
        context.req.param('id'),
        context.req.param('fileId'),
        context.req.query('reveal') === 'true',
      ),
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
    return context.json({ service: await manager.start(context.req.param('id')) })
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
  const indexHtml = await readFile(indexHtmlPath, 'utf8')
  app.get('*', (context) => context.html(indexHtml))
}

const server = serve({ fetch: app.fetch, hostname: host, port })
console.log(`\u001b[38;5;75mDev Hub is ready at ${origin}\u001b[0m`)

if (!apiOnly && process.env.DEV_HUB_OPEN_BROWSER !== 'false') {
  const browserCommand = process.platform === 'darwin' ? 'open' : 'xdg-open'
  const opener = spawn(browserCommand, [origin], { detached: true, stdio: 'ignore' })
  opener.unref()
}

let closing = false
const shutdown = async () => {
  if (closing) return
  closing = true
  processMetricsMonitor.close()
  gitMonitor.close()
  await manager.shutdown()
  await metricsStore.close()
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 1_500).unref()
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())
if (process.platform !== 'win32') process.on('SIGHUP', () => void shutdown())

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
