import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import useTrans from '~/hooks/useTrans'

import { alertItemReports } from './schema'

/** Shows the reports and original details that justify one reviewer-visible item. */
export default function ItemReports({ itemId }: { itemId: string }) {
  const { t } = useTrans()
  const [page, setPage] = useState(1)
  const reports = useQuery({
    queryKey: ['alert-wall-item-reports', itemId, page],
    queryFn: async () => {
      const response = await browserGraphQLRequest(alertItemReports, {
        id: itemId,
        pagi: { offset: { page, size: 20 } },
      })
      return response.alertItemReports
    },
  })

  if (reports.isPending) return <p className='text-digest text-sm'>{t('alert_wall.loading')}</p>
  if (reports.isError) return <p role='alert'>{t('alert_wall.load_error')}</p>

  return (
    <div className='border-divider border-t pt-3'>
      <ul className='divide-divider divide-y'>
        {reports.data.entries.map((report) => (
          <li key={report.id} className='py-2 text-sm'>
            <p className='font-medium'>
              {report.reportType} · {report.reporterLogin || '—'} · {report.insertedAt}
              {report.observedVersion ? ` · v${report.observedVersion}` : ''}
            </p>
            {report.details && <p className='text-digest whitespace-pre-wrap'>{report.details}</p>}
            <p className='text-digest text-xs'>
              {report.outdatedAt
                ? t('cms_review.outdated')
                : report.withdrawnAt
                  ? t('alert_wall.report_withdrawn')
                  : report.resolvedAt
                    ? t('alert_wall.report_resolved')
                    : t('alert_wall.report_active')}
            </p>
          </li>
        ))}
      </ul>
      {'totalPages' in reports.data.pageInfo && reports.data.pageInfo.totalPages > 1 && (
        <nav className='mt-2 flex items-center justify-end gap-3 text-sm'>
          <button
            type='button'
            className='border-divider rounded-md border px-3 py-1 disabled:opacity-50'
            disabled={!reports.data.pageInfo.hasPreviousPage || reports.isFetching}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
          >
            {t('alert_wall.previous_page')}
          </button>
          <span>
            {page} / {reports.data.pageInfo.totalPages}
          </span>
          <button
            type='button'
            className='border-divider rounded-md border px-3 py-1 disabled:opacity-50'
            disabled={!reports.data.pageInfo.hasNextPage || reports.isFetching}
            onClick={() => setPage((current) => current + 1)}
          >
            {t('alert_wall.next_page')}
          </button>
        </nav>
      )}
    </div>
  )
}
