import type { TMetricStorageNotice } from '@shared/contracts'
import { TriangleAlert } from 'lucide-react'

type TProps = {
  notices: TMetricStorageNotice[]
}

export function MetricsNoticeBar({ notices }: TProps) {
  if (notices.length === 0) return null

  return (
    <div className='metrics-notice-bar' role='status' aria-live='polite'>
      <TriangleAlert aria-hidden='true' />
      <div>
        <strong>Metrics history recording paused</strong>
        <span>
          {notices
            .map(
              (notice) =>
                `${notice.serviceName} ${formatBytes(notice.sizeBytes)} / ${formatBytes(notice.limitBytes)}`,
            )
            .join(' · ')}
          . Live metrics are unaffected.
        </span>
      </div>
    </div>
  )
}

function formatBytes(value: number): string {
  return `${Math.max(1, Math.round(value / 1024 ** 2))} MB`
}
