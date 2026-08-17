import { createReadStream } from 'node:fs'
import { appendFile, mkdir, readdir, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { createInterface } from 'node:readline'

import type {
  TBrowserMetricReport,
  TBrowserMetricSample,
  TBrowserMetricSnapshot,
  TMetricHistoryPayload,
  TMetricRange,
  TMetricSample,
  TMetricStorageNotice,
  TServerMetricSample,
  TServerMetricSnapshot,
  TServiceMetricsSnapshot,
} from '../shared/contracts.ts'
import type { TServiceDefinition } from './services.ts'

const DEFAULT_MAX_FILE_BYTES = 100 * 1024 * 1024
const FLUSH_INTERVAL_MS = 1_000
const BROWSER_TTL_MS = 7_000
const HEALTH_SAMPLE_COUNT = 3
const HISTORY_RESOLUTION_DEFAULT = 800
const HISTORY_RESOLUTION_MAX = 1_200

type TMetricsStoreEvent =
  | { type: 'metrics'; serviceId: string; metrics: TServiceMetricsSnapshot }
  | { type: 'metric-notices'; notices: TMetricStorageNotice[] }

type TFileState = {
  filePath: string
  sizeBytes: number
  capped: boolean
}

type THealthState = {
  aboveCount: number
  belowCount: number
  critical: boolean
}

type TMetricsStoreOptions = {
  maxFileBytes?: number
  now?: () => number
}

export class MetricsStore {
  private readonly definitions = new Map<string, TServiceDefinition>()
  private readonly snapshots = new Map<string, TServiceMetricsSnapshot>()
  private readonly browserPages = new Map<string, Map<string, TBrowserMetricSample>>()
  private readonly health = new Map<string, THealthState>()
  private readonly fileStates = new Map<string, TFileState>()
  private readonly pendingLines = new Map<string, string[]>()
  private readonly notices = new Map<string, TMetricStorageNotice>()
  private readonly subscribers = new Set<(event: TMetricsStoreEvent) => void>()
  private readonly maxFileBytes: number
  private readonly now: () => number
  private currentDay = ''
  private rotationPromise: Promise<void> | null = null
  private flushPromise: Promise<void> | null = null
  private flushTimer: NodeJS.Timeout | null = null
  private pruneTimer: NodeJS.Timeout | null = null

  constructor(
    private readonly rootDir: string,
    definitions: TServiceDefinition[],
    options: TMetricsStoreOptions = {},
  ) {
    this.maxFileBytes = options.maxFileBytes ?? DEFAULT_MAX_FILE_BYTES
    this.now = options.now ?? Date.now

    for (const definition of definitions) {
      this.definitions.set(definition.id, definition)
      this.snapshots.set(definition.id, emptySnapshot(definition.id))
    }
  }

  async initialize(): Promise<void> {
    await mkdir(this.rootDir, { recursive: true })
    await this.rotateTo(localDayKey(this.now()))

    this.flushTimer = setInterval(() => {
      void this.flush()
    }, FLUSH_INTERVAL_MS)
    this.flushTimer.unref()

    this.pruneTimer = setInterval(() => {
      this.pruneBrowserPages()
    }, FLUSH_INTERVAL_MS * 2)
    this.pruneTimer.unref()
  }

  subscribe(subscriber: (event: TMetricsStoreEvent) => void): () => void {
    this.subscribers.add(subscriber)
    return () => this.subscribers.delete(subscriber)
  }

  getSnapshots(): Record<string, TServiceMetricsSnapshot> {
    return Object.fromEntries(
      Array.from(this.snapshots, ([serviceId, snapshot]) => [serviceId, cloneSnapshot(snapshot)]),
    )
  }

  getNotices(): TMetricStorageNotice[] {
    return Array.from(this.notices.values(), (notice) => ({ ...notice }))
  }

  async recordServer(
    serviceId: string,
    runId: string,
    values: { cpuPercent: number; rssBytes: number; processCount: number },
  ): Promise<void> {
    const definition = this.requireDefinition(serviceId)
    const at = this.now()
    const sample: TServerMetricSample = {
      v: 1,
      kind: 'sample',
      source: 'server',
      at,
      serviceId,
      runId,
      cpuPercent: roundMetric(values.cpuPercent),
      rssBytes: Math.max(0, Math.round(values.rssBytes)),
      processCount: Math.max(0, Math.round(values.processCount)),
    }
    const server: TServerMetricSnapshot = {
      ...sample,
      cpuCritical: this.evaluateHealth(
        `${serviceId}:server:cpu`,
        sample.cpuPercent >= definition.metrics.serverCpuPercent,
      ),
      rssCritical: this.evaluateHealth(
        `${serviceId}:server:rss`,
        sample.rssBytes >= definition.metrics.serverRssBytes,
      ),
    }

    await this.record(sample)
    this.updateSnapshot(serviceId, { server })
  }

  async recordBrowser(report: TBrowserMetricReport): Promise<void> {
    const definition = this.requireDefinition(report.serviceId)
    const sample: TBrowserMetricSample = {
      v: 1,
      kind: 'sample',
      source: 'browser',
      at: this.now(),
      serviceId: report.serviceId,
      pageId: report.pageId,
      url: report.url,
      visibility: report.visibility,
      heapBytes: report.heapBytes === null ? null : Math.max(0, Math.round(report.heapBytes)),
      busyPercent:
        report.busyPercent === null
          ? null
          : Math.min(100, Math.max(0, roundMetric(report.busyPercent))),
    }
    const pages = this.browserPages.get(report.serviceId) || new Map<string, TBrowserMetricSample>()
    pages.set(report.pageId, sample)
    this.browserPages.set(report.serviceId, pages)

    await this.record(sample)
    this.updateBrowserSnapshot(report.serviceId, definition, pages)
  }

  clearServer(serviceId: string): void {
    const snapshot = this.snapshots.get(serviceId)
    if (!snapshot?.server) return

    this.health.delete(`${serviceId}:server:cpu`)
    this.health.delete(`${serviceId}:server:rss`)
    this.updateSnapshot(serviceId, { server: null })
  }

  async getHistory(
    serviceId: string,
    range: TMetricRange,
    resolution = HISTORY_RESOLUTION_DEFAULT,
  ): Promise<TMetricHistoryPayload> {
    const definition = this.requireDefinition(serviceId)
    await this.ensureCurrentDay()
    await this.flush()

    const to = this.now()
    const from = Math.max(startOfLocalDay(to), to - rangeToMs(range))
    const safeResolution = Math.min(HISTORY_RESOLUTION_MAX, Math.max(100, Math.round(resolution)))
    const bucketMs = Math.max(1, Math.ceil((to - from) / safeResolution))
    const state = this.fileStates.get(serviceId)
    if (!state) return { serviceId, from, to, bucketMs, samples: [] }

    const buckets = new Map<string, Map<number, TMetricSample>>()

    try {
      const lines = createInterface({
        input: createReadStream(state.filePath, { encoding: 'utf8' }),
        crlfDelay: Infinity,
      })

      for await (const line of lines) {
        const sample = parseMetricSample(line)
        if (!sample || sample.serviceId !== serviceId || sample.at < from || sample.at > to)
          continue

        const seriesKey =
          sample.source === 'server' ? `server:${sample.runId}` : `browser:${sample.pageId}`
        const bucketIndex = Math.min(
          safeResolution - 1,
          Math.max(0, Math.floor((sample.at - from) / bucketMs)),
        )
        const seriesBuckets = buckets.get(seriesKey) || new Map<number, TMetricSample>()
        const current = seriesBuckets.get(bucketIndex)

        if (!current || sampleScore(sample, definition) >= sampleScore(current, definition)) {
          seriesBuckets.set(bucketIndex, sample)
        }
        buckets.set(seriesKey, seriesBuckets)
      }
    } catch (error) {
      if (!isNodeError(error, 'ENOENT')) throw error
    }

    const samples = Array.from(buckets.values())
      .flatMap((seriesBuckets) => Array.from(seriesBuckets.values()))
      .sort((left, right) => left.at - right.at)

    return { serviceId, from, to, bucketMs, samples }
  }

  async flush(): Promise<void> {
    if (this.flushPromise) {
      await this.flushPromise
      if (this.pendingLines.size > 0) await this.flush()
      return
    }
    if (this.pendingLines.size === 0) return

    const batch = new Map(this.pendingLines)
    this.pendingLines.clear()
    this.flushPromise = Promise.all(
      Array.from(batch, ([serviceId, lines]) => this.flushService(serviceId, lines)),
    )
      .then(() => undefined)
      .finally(() => {
        this.flushPromise = null
      })

    await this.flushPromise
    if (this.pendingLines.size > 0) await this.flush()
  }

  async close(): Promise<void> {
    if (this.flushTimer) clearInterval(this.flushTimer)
    if (this.pruneTimer) clearInterval(this.pruneTimer)
    this.flushTimer = null
    this.pruneTimer = null
    await this.flush()
  }

  private async record(sample: TMetricSample): Promise<void> {
    await this.ensureCurrentDay()
    const state = this.fileStates.get(sample.serviceId)
    if (!state || state.capped) return

    const lines = this.pendingLines.get(sample.serviceId) || []
    lines.push(`${JSON.stringify(sample)}\n`)
    this.pendingLines.set(sample.serviceId, lines)
  }

  private updateSnapshot(
    serviceId: string,
    next: Partial<Pick<TServiceMetricsSnapshot, 'server' | 'browser' | 'browserPageCount'>>,
  ): void {
    const current = this.snapshots.get(serviceId) || emptySnapshot(serviceId)
    const snapshot = { ...current, ...next }
    this.snapshots.set(serviceId, snapshot)
    this.emit({ type: 'metrics', serviceId, metrics: cloneSnapshot(snapshot) })
  }

  private updateBrowserSnapshot(
    serviceId: string,
    definition: TServiceDefinition,
    pages: Map<string, TBrowserMetricSample>,
  ): void {
    let selected: TBrowserMetricSample | undefined
    for (const page of pages.values()) {
      if (
        !selected ||
        (page.visibility === 'visible' && selected.visibility !== 'visible') ||
        (page.visibility === selected.visibility && page.at > selected.at)
      ) {
        selected = page
      }
    }

    if (!selected) {
      this.updateSnapshot(serviceId, { browser: null, browserPageCount: 0 })
      return
    }

    const browser: TBrowserMetricSnapshot = {
      at: selected.at,
      pageId: selected.pageId,
      url: selected.url,
      visibility: selected.visibility,
      heapBytes: selected.heapBytes,
      busyPercent: selected.busyPercent,
      heapCritical: this.evaluateHealth(
        `${serviceId}:browser:${selected.pageId}:heap`,
        selected.heapBytes === null
          ? null
          : selected.heapBytes >= definition.metrics.browserHeapBytes,
      ),
      busyCritical: this.evaluateHealth(
        `${serviceId}:browser:${selected.pageId}:busy`,
        selected.busyPercent === null
          ? null
          : selected.busyPercent >= definition.metrics.browserBusyPercent,
      ),
    }

    this.updateSnapshot(serviceId, { browser, browserPageCount: pages.size })
  }

  private pruneBrowserPages(): void {
    const expiresBefore = this.now() - BROWSER_TTL_MS

    for (const [serviceId, pages] of this.browserPages) {
      let changed = false
      for (const [pageId, sample] of pages) {
        if (sample.at >= expiresBefore) continue
        pages.delete(pageId)
        this.health.delete(`${serviceId}:browser:${pageId}:heap`)
        this.health.delete(`${serviceId}:browser:${pageId}:busy`)
        changed = true
      }

      if (!changed) continue
      if (pages.size === 0) this.browserPages.delete(serviceId)
      this.updateBrowserSnapshot(serviceId, this.requireDefinition(serviceId), pages)
    }
  }

  private evaluateHealth(key: string, overThreshold: boolean | null): boolean {
    if (overThreshold === null) {
      this.health.delete(key)
      return false
    }

    const state = this.health.get(key) || {
      aboveCount: 0,
      belowCount: 0,
      critical: false,
    }

    if (overThreshold) {
      state.aboveCount += 1
      state.belowCount = 0
      if (state.aboveCount >= HEALTH_SAMPLE_COUNT) state.critical = true
    } else {
      state.aboveCount = 0
      state.belowCount += 1
      if (state.belowCount >= HEALTH_SAMPLE_COUNT) state.critical = false
    }

    this.health.set(key, state)
    return state.critical
  }

  private async ensureCurrentDay(): Promise<void> {
    const nextDay = localDayKey(this.now())
    if (nextDay === this.currentDay) return
    if (!this.rotationPromise) {
      this.rotationPromise = this.rotateTo(nextDay).finally(() => {
        this.rotationPromise = null
      })
    }
    await this.rotationPromise
  }

  private async rotateTo(day: string): Promise<void> {
    if (this.currentDay) await this.flush()

    const entries = await readdir(this.rootDir, { withFileTypes: true })
    await Promise.all(
      entries
        .filter((entry) => entry.name !== day)
        .map((entry) => rm(path.join(this.rootDir, entry.name), { force: true, recursive: true })),
    )

    const dayDir = path.join(this.rootDir, day)
    await mkdir(dayDir, { recursive: true })
    this.currentDay = day
    this.fileStates.clear()
    this.notices.clear()

    await Promise.all(
      Array.from(this.definitions.values(), async (definition) => {
        const filePath = path.join(dayDir, `${definition.id}.jsonl`)
        const sizeBytes = await fileSize(filePath)
        const state = {
          filePath,
          sizeBytes,
          capped: sizeBytes >= this.maxFileBytes,
        }
        this.fileStates.set(definition.id, state)
        if (state.capped) this.markCapped(definition.id, state)
      }),
    )

    this.emitNotices()
  }

  private async flushService(serviceId: string, lines: string[]): Promise<void> {
    const state = this.fileStates.get(serviceId)
    if (!state || state.capped || lines.length === 0) return

    const accepted: string[] = []
    for (const line of lines) {
      const bytes = Buffer.byteLength(line)
      if (state.sizeBytes + bytes > this.maxFileBytes) {
        this.markCapped(serviceId, state)
        break
      }
      accepted.push(line)
      state.sizeBytes += bytes
    }

    if (accepted.length > 0) await appendFile(state.filePath, accepted.join(''), 'utf8')
  }

  private markCapped(serviceId: string, state: TFileState): void {
    if (state.capped && this.notices.has(serviceId)) return
    state.capped = true
    const definition = this.requireDefinition(serviceId)
    this.notices.set(serviceId, {
      serviceId,
      serviceName: definition.name,
      sizeBytes: state.sizeBytes,
      limitBytes: this.maxFileBytes,
      recordingPaused: true,
    })
    this.emitNotices()
  }

  private emitNotices(): void {
    this.emit({ type: 'metric-notices', notices: this.getNotices() })
  }

  private emit(event: TMetricsStoreEvent): void {
    for (const subscriber of this.subscribers) subscriber(event)
  }

  private requireDefinition(serviceId: string): TServiceDefinition {
    const definition = this.definitions.get(serviceId)
    if (!definition) throw new Error(`Unknown metrics service: ${serviceId}`)
    return definition
  }
}

export function rangeToMs(range: TMetricRange): number {
  if (range === '15m') return 15 * 60_000
  if (range === '1h') return 60 * 60_000
  if (range === '6h') return 6 * 60 * 60_000
  return 24 * 60 * 60_000
}

function emptySnapshot(serviceId: string): TServiceMetricsSnapshot {
  return {
    serviceId,
    server: null,
    browser: null,
    browserPageCount: 0,
  }
}

function cloneSnapshot(snapshot: TServiceMetricsSnapshot): TServiceMetricsSnapshot {
  return {
    ...snapshot,
    server: snapshot.server ? { ...snapshot.server } : null,
    browser: snapshot.browser ? { ...snapshot.browser } : null,
  }
}

function localDayKey(timestamp: number): string {
  const date = new Date(timestamp)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

async function fileSize(filePath: string): Promise<number> {
  try {
    return (await stat(filePath)).size
  } catch (error) {
    if (isNodeError(error, 'ENOENT')) return 0
    throw error
  }
}

function parseMetricSample(line: string): TMetricSample | null {
  try {
    const sample = JSON.parse(line) as Partial<TMetricSample>
    if (
      sample.v !== 1 ||
      sample.kind !== 'sample' ||
      typeof sample.at !== 'number' ||
      typeof sample.serviceId !== 'string' ||
      (sample.source !== 'server' && sample.source !== 'browser')
    ) {
      return null
    }
    return sample as TMetricSample
  } catch {
    return null
  }
}

function sampleScore(sample: TMetricSample, definition: TServiceDefinition): number {
  if (sample.source === 'server') {
    return Math.max(
      sample.cpuPercent / definition.metrics.serverCpuPercent,
      sample.rssBytes / definition.metrics.serverRssBytes,
    )
  }

  return Math.max(
    (sample.busyPercent || 0) / definition.metrics.browserBusyPercent,
    (sample.heapBytes || 0) / definition.metrics.browserHeapBytes,
  )
}

function roundMetric(value: number): number {
  return Math.round(value * 10) / 10
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}
