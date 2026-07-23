import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import type { MetricsStore } from './metrics-store.ts'
import type { TManagedProcessTarget, ServiceManager } from './process-manager.ts'

const execFileAsync = promisify(execFile)
const SAMPLE_INTERVAL_MS = 2_000

type TProcessRow = {
  pid: number
  processGroupId: number
  cpuPercent: number
  rssKb: number
}

export class ProcessMetricsMonitor {
  private timer: NodeJS.Timeout | null = null
  private sampling = false
  private previousServiceIds = new Set<string>()

  constructor(
    private readonly manager: ServiceManager,
    private readonly store: MetricsStore,
  ) {}

  start(): void {
    if (this.timer) return
    void this.sample()
    this.timer = setInterval(() => {
      void this.sample()
    }, SAMPLE_INTERVAL_MS)
    this.timer.unref()
  }

  close(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  private async sample(): Promise<void> {
    if (this.sampling) return
    this.sampling = true

    try {
      const targets = this.manager.listMetricTargets()
      const currentServiceIds = new Set(targets.map((target) => target.serviceId))

      for (const serviceId of this.previousServiceIds) {
        if (!currentServiceIds.has(serviceId)) this.store.clearServer(serviceId)
      }
      this.previousServiceIds = currentServiceIds

      if (targets.length === 0 || process.platform === 'win32') return
      const rows = await readProcessTable()
      await Promise.all(
        targets.map(async (target) => {
          const aggregate = aggregateProcessGroup(rows, target)
          if (!aggregate) {
            this.store.clearServer(target.serviceId)
            return
          }

          await this.store.recordServer(target.serviceId, target.runId, aggregate)
        }),
      )
    } catch (error) {
      console.error('Could not sample managed process metrics.', error)
    } finally {
      this.sampling = false
    }
  }
}

export function parseProcessTable(output: string): TProcessRow[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const [pid, processGroupId, cpuPercent, rssKb] = line.split(/\s+/).map(Number)
      return [pid, processGroupId, cpuPercent, rssKb].every(Number.isFinite)
        ? [{ pid, processGroupId, cpuPercent, rssKb }]
        : []
    })
}

export function aggregateProcessGroup(
  rows: TProcessRow[],
  target: TManagedProcessTarget,
): { cpuPercent: number; rssBytes: number; processCount: number } | null {
  let cpuPercent = 0
  let rssKb = 0
  let processCount = 0

  for (const row of rows) {
    if (row.processGroupId !== target.pid) continue
    cpuPercent += row.cpuPercent
    rssKb += row.rssKb
    processCount += 1
  }

  if (processCount === 0) return null
  return {
    cpuPercent,
    rssBytes: rssKb * 1024,
    processCount,
  }
}

async function readProcessTable(): Promise<TProcessRow[]> {
  const { stdout } = await execFileAsync('ps', ['-axo', 'pid=,pgid=,%cpu=,rss='], {
    maxBuffer: 4 * 1024 * 1024,
  })
  return parseProcessTable(stdout)
}
