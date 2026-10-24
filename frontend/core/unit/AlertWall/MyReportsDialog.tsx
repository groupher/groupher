import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import useTrans from '~/hooks/useTrans'
import { invalidatePrefix } from '~/query/invalidation/executor'
import { viewerQueryKeys } from '~/query/key'

import { myReports, withdrawReport } from './schema'

type TProps = { accountRef: string | null; onClose: () => void }

/** Displays a signed-in reporter's active reports and withdraw controls. */
export default function MyReportsDialog({ accountRef, onClose }: TProps) {
  const { t } = useTrans()
  const client = useQueryClient()
  const commandIds = useRef(new Map<string, string>())
  const reports = useQuery({
    queryKey: viewerQueryKeys.myReports(accountRef || 'anonymous', 1),
    queryFn: async () => {
      const response = await browserGraphQLRequest(myReports, {
        pagi: { offset: { page: 1, size: 50 } },
      })
      return response.myReports.entries
    },
    enabled: Boolean(accountRef),
  })
  const withdraw = useMutation({
    mutationFn: (reportId: string) => {
      let commandId = commandIds.current.get(reportId)
      if (!commandId) {
        commandId = crypto.randomUUID()
        commandIds.current.set(reportId, commandId)
      }

      return browserGraphQLRequest(withdrawReport, { reportId, commandId })
    },
    onSuccess: async (_result, reportId) => {
      commandIds.current.delete(reportId)
      await invalidatePrefix(client, viewerQueryKeys.myReportsPrefix(accountRef || 'anonymous'))
    },
  })

  return (
    <div className='bg-modal-mask fixed inset-0 z-50 grid place-items-center p-4'>
      <section
        role='dialog'
        aria-modal='true'
        aria-labelledby='my-reports-title'
        className='border-divider bg-modal-bg max-h-full w-full max-w-2xl overflow-auto rounded-lg border p-5 shadow-lg'
      >
        <header className='flex items-center justify-between gap-4'>
          <h2 id='my-reports-title' className='text-lg font-semibold'>
            {t('alert_wall.my_reports')}
          </h2>
          <button
            type='button'
            className='border-divider rounded-md border px-3 py-1.5 text-sm'
            onClick={onClose}
          >
            {t('alert_wall.report_cancel')}
          </button>
        </header>

        {reports.isPending ? (
          <p className='text-digest py-6 text-sm'>{t('alert_wall.loading')}</p>
        ) : reports.isError ? (
          <p role='alert' className='py-6 text-sm text-red-600'>
            {t('alert_wall.my_reports_error')}
          </p>
        ) : reports.data.length === 0 ? (
          <p className='text-digest py-6 text-sm'>{t('alert_wall.my_reports_empty')}</p>
        ) : (
          <ul className='divide-divider mt-4 divide-y'>
            {reports.data.map((report) => (
              <li key={report.id} className='py-4'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div className='min-w-0'>
                    <p className='font-medium'>
                      {report.targetType.toLowerCase()} · {report.targetId}
                    </p>
                    <p className='text-digest mt-1 text-xs'>
                      {report.reportType} · {report.insertedAt}
                    </p>
                    {report.details && (
                      <p className='text-digest mt-2 text-sm whitespace-pre-wrap'>
                        {report.details}
                      </p>
                    )}
                  </div>
                  {!report.withdrawnAt && (
                    <button
                      type='button'
                      className='border-divider rounded-md border px-3 py-2 text-sm disabled:opacity-50'
                      disabled={withdraw.isPending}
                      onClick={() => withdraw.mutate(report.id)}
                    >
                      {withdraw.isPending
                        ? t('alert_wall.report_withdrawing')
                        : t('alert_wall.report_withdraw')}
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {withdraw.isError && (
          <p role='alert' className='mt-3 text-sm text-red-600'>
            {t('alert_wall.report_withdraw_error')}
          </p>
        )}
      </section>
    </div>
  )
}
