'use client'

import { prettyNum } from '~/fmt'
import useTrans from '~/hooks/useTrans'
import type { TTransKey } from '~/spec'
import { Portal } from '~/unit/DashboardThread'

import type { TWebAnalysisSummary } from './helper'

type TProps = {
  data: TWebAnalysisSummary
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
  data: TWebAnalysisSummary,
): { key: string; label: TTransKey; value: string }[] => [
  { key: 'pageviews', label: 'dsb.analysis.pageviews', value: prettyNum(data.summary.pageviews) },
  { key: 'visitors', label: 'dsb.analysis.visitors', value: prettyNum(data.summary.visitors) },
  { key: 'visits', label: 'dsb.analysis.visits', value: prettyNum(data.summary.visits) },
  { key: 'bounces', label: 'dsb.analysis.bounces', value: prettyNum(data.summary.bounces) },
  {
    key: 'totalTime',
    label: 'dsb.analysis.total_time',
    value: formatDuration(data.summary.totalTime),
  },
]

export default function WebAnalysisClient({ data }: TProps) {
  const { t } = useTrans()
  const isUnavailable = data.status !== 'ready'

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

      <section className='mt-6 grid grid-cols-1 gap-5 xl:grid-cols-2'>
        <div className='border-alphathin rounded-md border p-4'>
          <h3 className='text-title text-base'>{t('dsb.analysis.top_pages')}</h3>
          <div className='column mt-4 gap-y-3'>
            {data.topPages.length > 0 ? (
              data.topPages.map((page) => (
                <div key={page.path} className='row-between gap-x-4 text-sm'>
                  <div className='text-digest min-w-0 truncate'>{page.path}</div>
                  <div className='text-title shrink-0'>{prettyNum(page.pageviews)}</div>
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
            {data.topReferrers.length > 0 ? (
              data.topReferrers.map((referrer) => (
                <div key={referrer.referrer} className='row-between gap-x-4 text-sm'>
                  <div className='text-digest min-w-0 truncate'>{referrer.referrer}</div>
                  <div className='text-title shrink-0'>{prettyNum(referrer.visitors)}</div>
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
