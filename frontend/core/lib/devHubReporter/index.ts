const REPORT_INTERVAL_MS = 2_000
const INITIAL_REPORT_DELAY_MS = 500
const DEFAULT_DEV_HUB_URL = 'http://127.0.0.1:4311'
const PAGE_ID_KEY = 'groupher.dev-hub.page-id'
const REGISTRY_KEY = '__groupherDevHubReporters__'

type TReporterOptions = {
  serviceId: string
  endpoint?: string
}

type TReporterHandle = {
  refs: number
  stop: () => void
}

type TReporterRegistryWindow = Window & {
  [REGISTRY_KEY]?: Map<string, TReporterHandle>
}

type TChromiumPerformance = Performance & {
  memory?: {
    usedJSHeapSize?: number
  }
}

export function startDevHubReporter({ serviceId, endpoint }: TReporterOptions): () => void {
  const hubUrl = normalizeHubUrl(endpoint)
  const key = `${serviceId}:${hubUrl}`
  const registryWindow = window as TReporterRegistryWindow
  const registry = registryWindow[REGISTRY_KEY] || new Map<string, TReporterHandle>()
  registryWindow[REGISTRY_KEY] = registry

  const existing = registry.get(key)
  if (existing) {
    existing.refs += 1
    return () => releaseReporter(registry, key)
  }

  const handle = createReporter(serviceId, hubUrl)
  registry.set(key, handle)
  return () => releaseReporter(registry, key)
}

function createReporter(serviceId: string, hubUrl: string): TReporterHandle {
  const pageId = getPageId()
  const controller = new AbortController()
  let disposed = false
  let busyMs = 0
  let windowStartedAt = performance.now()
  let nextAttemptAt = 0
  let failures = 0
  let reporting = false

  const observer = createLongTaskObserver((duration) => {
    busyMs += duration
  })

  const report = async () => {
    if (disposed || reporting) return

    const now = performance.now()
    const sampleWindowMs = Math.max(1, now - windowStartedAt)
    const busyPercent = Math.min(100, (busyMs / sampleWindowMs) * 100)
    busyMs = 0
    windowStartedAt = now

    if (Date.now() < nextAttemptAt) return
    reporting = true

    try {
      const response = await fetch(`${hubUrl}/api/browser-metrics`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          pageId,
          url: window.location.href,
          visibility: document.visibilityState === 'visible' ? 'visible' : 'hidden',
          heapBytes: readHeapBytes(),
          busyPercent,
          sampleWindowMs,
        }),
        keepalive: true,
        signal: controller.signal,
      })
      if (!response.ok) throw new Error(`Dev Hub reporter returned ${response.status}.`)
      failures = 0
      nextAttemptAt = 0
    } catch {
      if (!disposed) {
        failures += 1
        nextAttemptAt = Date.now() + Math.min(30_000, REPORT_INTERVAL_MS * 2 ** failures)
      }
    } finally {
      reporting = false
    }
  }

  const initialTimer = window.setTimeout(() => void report(), INITIAL_REPORT_DELAY_MS)
  const interval = window.setInterval(() => void report(), REPORT_INTERVAL_MS)

  return {
    refs: 1,
    stop: () => {
      disposed = true
      controller.abort()
      observer?.disconnect()
      window.clearTimeout(initialTimer)
      window.clearInterval(interval)
    },
  }
}

function createLongTaskObserver(
  onDuration: (duration: number) => void,
): PerformanceObserver | null {
  if (
    typeof PerformanceObserver === 'undefined' ||
    !PerformanceObserver.supportedEntryTypes.includes('longtask')
  ) {
    return null
  }

  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) onDuration(entry.duration)
  })
  observer.observe({ entryTypes: ['longtask'] })
  return observer
}

function readHeapBytes(): number | null {
  const value = (performance as TChromiumPerformance).memory?.usedJSHeapSize
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function getPageId(): string {
  try {
    const existing = sessionStorage.getItem(PAGE_ID_KEY)
    if (existing) return existing

    const next = crypto.randomUUID()
    sessionStorage.setItem(PAGE_ID_KEY, next)
    return next
  } catch {
    return crypto.randomUUID()
  }
}

function normalizeHubUrl(endpoint?: string): string {
  return (endpoint || DEFAULT_DEV_HUB_URL).replace(/\/+$/, '')
}

function releaseReporter(registry: Map<string, TReporterHandle>, key: string): void {
  const handle = registry.get(key)
  if (!handle) return
  handle.refs -= 1
  if (handle.refs > 0) return
  handle.stop()
  registry.delete(key)
}
