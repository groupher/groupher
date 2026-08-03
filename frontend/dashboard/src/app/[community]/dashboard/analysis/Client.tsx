'use client'

import { prettyNum } from '~/fmt'
import useTrans from '~/hooks/useTrans'
import type { TTransKey } from '~/spec'
import { Portal } from '~/unit/DashboardThread'

import TrendChart from './components/TrendChart'
import type { TAnalysisWebMetric, TAnalysisWebOverview } from './helper'

type TProps = {
  data: TAnalysisWebOverview
}

const formatDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0s'
  if (seconds < 60) return `${Math.round(seconds)}s`

  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`

  const hours = Math.round(minutes / 60)
  if (hours < 48) return `${hours}h`

  return `${Math.round(hours / 24)}d`
}

const summaryItems = (
  data: TAnalysisWebOverview,
): { key: string; label: TTransKey; value: string }[] => [
  {
    key: 'pageviews',
    label: 'dsb.analysis.pageviews',
    value: formatMetric(data.summary.pageviews),
  },
  { key: 'visitors', label: 'dsb.analysis.visitors', value: formatMetric(data.summary.visitors) },
  { key: 'visits', label: 'dsb.analysis.visits', value: formatMetric(data.summary.visits) },
  { key: 'bounces', label: 'dsb.analysis.bounces', value: formatPercent(data.summary.bounceRate) },
  {
    key: 'totalTime',
    label: 'dsb.analysis.total_time',
    value: formatDuration(data.summary.visitDuration.value),
  },
]

const formatMetric = (metric: TAnalysisWebMetric): string => prettyNum(metric.value)
const formatPercent = (metric: TAnalysisWebMetric): string => `${Math.round(metric.value * 100)}%`

export default function AnalysisWebClient({ data }: TProps) {
  const { t } = useTrans()
  const isUnavailable = data.status === 'unavailable'

  return (
    <div className='column w-3/5'>
      <Portal
        title={t('dsb.menu.analysis')}
        desc={t('dsb.analysis.desc')}
        withDivider
        addon={
          <div className='border-alphathin text-digest rounded-md border px-3 py-1 text-xs'>
            {data.pathScope}
          </div>
        }
      />

      {isUnavailable ? (
        <section className='border-alphathin text-digest mb-5 rounded-md border px-4 py-3 text-sm'>
          {t('dsb.analysis.unavailable')}
        </section>
      ) : null}

      <section className='grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5'>
        {summaryItems(data).map((item) => (
          <div key={item.key} className='border-alphathin rounded-md border p-4'>
            <div className='text-digest text-xs'>{t(item.label)}</div>
            <div className='text-title mt-2 text-2xl'>{item.value}</div>
          </div>
        ))}
      </section>

      <section className='mt-5'>
        <TrendChart
          emptyLabel={t('dsb.analysis.empty')}
          peakLabel=''
          points={data.timeseries.points}
          title={t('dsb.menu.analysis')}
          viewsLabel={t('dsb.analysis.pageviews')}
          visitsLabel={t('dsb.analysis.visits')}
        />
      </section>

      <section className='mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2'>
        <div className='border-alphathin rounded-md border p-4'>
          <h3 className='text-title text-base'>{t('dsb.analysis.top_pages')}</h3>
          <div className='column mt-4 gap-y-3'>
            {data.pages.path.length > 0 ? (
              data.pages.path.map((page) => (
                <div key={page.value} className='row-between gap-x-4 text-sm'>
                  <div className='text-digest min-w-0 truncate'>{page.value}</div>
                  <div className='text-title shrink-0'>{prettyNum(page.metrics.views)}</div>
                </div>
              ))
            ) : (
              <div className='text-digest text-sm'>{t('dsb.analysis.empty')}</div>
            )}
          </div>
        </div>

        <div className='border-alphathin rounded-md border p-4'>
          <h3 className='text-title text-base'>{t('dsb.analysis.referrers')}</h3>
          <div className='column mt-4 gap-y-3'>
            {data.sources.referrer.length > 0 ? (
              data.sources.referrer.map((referrer) => (
                <div key={referrer.value} className='row-between gap-x-4 text-sm'>
                  <div className='text-digest min-w-0 truncate'>{referrer.label}</div>
                  <div className='text-title shrink-0'>{prettyNum(referrer.metrics.visitors)}</div>
                </div>
              ))
            ) : (
              <div className='text-digest text-sm'>{t('dsb.analysis.empty')}</div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
