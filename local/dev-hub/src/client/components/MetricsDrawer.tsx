import { Dialog } from '@base-ui/react/dialog'
import type {
  TBrowserMetricSample,
  TMetricHistoryPayload,
  TMetricRange,
  TPublicService,
  TServerMetricSample,
  TServiceMetricsSnapshot,
} from '@shared/contracts'
import { ChartNoAxesCombined, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'

import { fetchMetricHistory } from '@/lib/hub-client'

import { CurrentMetric } from './CurrentMetric'
import { MetricTrendChart, type TMetricTrendPoint } from './MetricTrendChart'

type TProps = {
  service: TPublicService
  current?: TServiceMetricsSnapshot
  onClose: () => void
}

const RANGE_LABELS: Record<TMetricRange, string> = {
  '15m': '15 min',
  '1h': '1 hour',
  '6h': '6 hours',
  '24h': 'Today',
}

const RANGES = Object.keys(RANGE_LABELS) as TMetricRange[]
const MB = 1024 * 1024

export function MetricsDrawer({ service, current, onClose }: TProps) {
  const [range, setRange] = useState<TMetricRange>('1h')
  const [history, setHistory] = useState<TMetricHistoryPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [requestVersion, setRequestVersion] = useState(0)
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)

    void fetchMetricHistory(service.id, range, controller.signal)
      .then(setHistory)
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) {
          setError(cause instanceof Error ? cause.message : 'Could not load metric history.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [range, requestVersion, service.id])

  const serverSamples = useMemo(() => history?.samples.filter(isServerSample) || [], [history])
  const browserSamples = useMemo(() => history?.samples.filter(isBrowserSample) || [], [history])
  const pageIds = useMemo(
    () => Array.from(new Set(browserSamples.map((sample) => sample.pageId))),
    [browserSamples],
  )
  const activePageId =
    (selectedPageId && pageIds.includes(selectedPageId) ? selectedPageId : null) ||
    (current?.browser && pageIds.includes(current.browser.pageId)
      ? current.browser.pageId
      : null) ||
    pageIds[0] ||
    null
  const activeBrowserSamples = activePageId
    ? browserSamples.filter((sample) => sample.pageId === activePageId)
    : []
  const bucketMs = history?.bucketMs || 1_000
  const thresholds = service.metricThresholds

  return (
    <Dialog.Root open onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className='metrics-drawer-backdrop' />
        <Dialog.Viewport className='metrics-drawer-viewport'>
          <Dialog.Popup className='metrics-drawer-popup' data-service-id={service.id}>
            <header className='metrics-drawer-header'>
              <div className='metrics-drawer-title-group'>
                <ChartNoAxesCombined aria-hidden='true' />
                <div>
                  <span className='metrics-drawer-kicker'>Performance history</span>
                  <Dialog.Title>{service.name}</Dialog.Title>
                </div>
              </div>
              <Dialog.Close className='metrics-drawer-close' aria-label='Close metric history'>
                <X aria-hidden='true' />
              </Dialog.Close>
            </header>

            <div className='metrics-drawer-toolbar'>
              <div className='metrics-drawer-tabs' role='tablist' aria-label='Metric time range'>
                {RANGES.map((item) => (
                  <button
                    type='button'
                    role='tab'
                    aria-selected={range === item}
                    className={range === item ? 'is-active' : ''}
                    key={item}
                    onClick={() => setRange(item)}
                  >
                    {RANGE_LABELS[item]}
                  </button>
                ))}
              </div>

              {pageIds.length > 1 ? (
                <label className='metrics-page-select'>
                  <span>Browser page</span>
                  <select
                    value={activePageId || ''}
                    onChange={(event) => setSelectedPageId(event.target.value)}
                  >
                    {pageIds.map((pageId, index) => (
                      <option key={pageId} value={pageId}>
                        Page {index + 1}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>

            <div className={`metrics-current-row metrics-current-row--${service.group}`}>
              {service.group === 'frontend' ? (
                <>
                  <CurrentMetric
                    label='Page heap'
                    value={formatBytes(current?.browser?.heapBytes)}
                    critical={current?.browser?.heapCritical}
                  />
                  <CurrentMetric
                    label='Busy'
                    value={formatPercent(current?.browser?.busyPercent)}
                    critical={current?.browser?.busyCritical}
                  />
                </>
              ) : null}
              <CurrentMetric
                label='Server CPU'
                value={formatPercent(current?.server?.cpuPercent)}
                critical={current?.server?.cpuCritical}
              />
              <CurrentMetric
                label='Server memory'
                value={formatBytes(current?.server?.rssBytes)}
                critical={current?.server?.rssCritical}
              />
            </div>

            <div className='metrics-drawer-content'>
              {loading ? (
                <div className='metrics-drawer-state'>Loading metric history…</div>
              ) : error ? (
                <div className='metrics-drawer-state is-error'>
                  <span>{error}</span>
                  <button type='button' onClick={() => setRequestVersion((value) => value + 1)}>
                    Try again
                  </button>
                </div>
              ) : (
                <div className='metrics-chart-grid'>
                  {service.group === 'frontend' ? (
                    <>
                      <MetricTrendChart
                        title='Page heap'
                        unit='MB'
                        points={toBrowserPoints(activeBrowserSamples, 'heapBytes', MB)}
                        threshold={thresholds.browserHeapBytes / MB}
                        bucketMs={bucketMs}
                      />
                      <MetricTrendChart
                        title='Main-thread busy'
                        unit='%'
                        points={toBrowserPoints(activeBrowserSamples, 'busyPercent')}
                        threshold={thresholds.browserBusyPercent}
                        bucketMs={bucketMs}
                      />
                    </>
                  ) : null}
                  <MetricTrendChart
                    title='Server CPU'
                    unit='%'
                    points={toServerPoints(serverSamples, 'cpuPercent')}
                    threshold={thresholds.serverCpuPercent}
                    bucketMs={bucketMs}
                  />
                  <MetricTrendChart
                    title='Server memory'
                    unit='MB'
                    points={toServerPoints(serverSamples, 'rssBytes', MB)}
                    threshold={thresholds.serverRssBytes / MB}
                    bucketMs={bucketMs}
                  />
                </div>
              )}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function isServerSample(
  sample: TMetricHistoryPayload['samples'][number],
): sample is TServerMetricSample {
  return sample.source === 'server'
}

function isBrowserSample(
  sample: TMetricHistoryPayload['samples'][number],
): sample is TBrowserMetricSample {
  return sample.source === 'browser'
}

function toServerPoints(
  samples: TServerMetricSample[],
  key: 'cpuPercent' | 'rssBytes',
  divisor = 1,
): TMetricTrendPoint[] {
  return samples.map((sample) => ({
    at: sample.at,
    value: sample[key] / divisor,
    runKey: sample.runId,
  }))
}

function toBrowserPoints(
  samples: TBrowserMetricSample[],
  key: 'heapBytes' | 'busyPercent',
  divisor = 1,
): TMetricTrendPoint[] {
  return samples.map((sample) => ({
    at: sample.at,
    value: sample[key] === null ? null : sample[key] / divisor,
    runKey: sample.pageId,
  }))
}

function formatBytes(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return value >= 1024 ** 3
    ? `${(value / 1024 ** 3).toFixed(1)} GB`
    : `${Math.round(value / MB)} MB`
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `${value < 10 ? value.toFixed(1) : Math.round(value)}%`
}
