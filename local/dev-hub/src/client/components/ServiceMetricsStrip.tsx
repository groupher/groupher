import type { TPublicService, TServiceMetricsSnapshot } from '@shared/contracts'
import { ChevronRight } from 'lucide-react'

type TProps = {
  service: TPublicService
  metrics?: TServiceMetricsSnapshot
  onOpen: () => void
}

export function ServiceMetricsStrip({ service, metrics, onOpen }: TProps) {
  const server = metrics?.server
  const browser = metrics?.browser
  const isFrontend = service.group === 'frontend'

  return (
    <div className='service-metrics-strip'>
      <div className='service-metrics-values'>
        {isFrontend ? (
          <span className='metric-cluster' title={browser?.url || 'No browser page is reporting'}>
            <span className='metric-label'>Page</span>
            {browser ? (
              <>
                <strong className={browser.heapCritical ? 'is-critical' : ''}>
                  {formatBytes(browser.heapBytes)}
                </strong>
                <span className='metric-separator'>·</span>
                <strong className={browser.busyCritical ? 'is-critical' : ''}>
                  {formatPercent(browser.busyPercent)}
                </strong>
                <span className='metric-suffix'>busy</span>
              </>
            ) : (
              <span className='metric-empty'>not open</span>
            )}
          </span>
        ) : null}

        <span className='metric-cluster'>
          <span className='metric-label'>{isFrontend ? 'Server' : 'CPU'}</span>
          {server ? (
            <>
              <strong className={server.cpuCritical ? 'is-critical' : ''}>
                {formatPercent(server.cpuPercent)}
              </strong>
              <span className='metric-separator'>·</span>
              <span className='metric-suffix'>Mem</span>
              <strong className={server.rssCritical ? 'is-critical' : ''}>
                {formatBytes(server.rssBytes)}
              </strong>
            </>
          ) : (
            <span className='metric-empty'>—</span>
          )}
        </span>
      </div>

      <button
        type='button'
        className='service-metrics-more'
        onClick={onOpen}
        aria-label={`Open ${service.name} metric history`}
      >
        <ChevronRight aria-hidden='true' />
      </button>
    </div>
  )
}

function formatBytes(value: number | null): string {
  if (value === null) return '—'
  if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GB`
  return `${Math.round(value / 1024 ** 2)} MB`
}

function formatPercent(value: number | null): string {
  if (value === null) return '—'
  return `${value < 10 ? value.toFixed(1) : Math.round(value)}%`
}
