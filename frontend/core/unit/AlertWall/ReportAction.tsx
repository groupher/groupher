import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import type { AlertReportTargetInput } from '~/graphql/generated/graphql'
import useTrans from '~/hooks/useTrans'
import { invalidatePrefix } from '~/query/invalidation/executor'
import { viewerQueryKeys } from '~/query/key'
import { authWarn } from '~/signal'
import useAccount from '~/stores/account/hooks'

import { submitReport } from './schema'

const reportTypes = ['SPAM', 'HARASSMENT', 'ILLEGAL_CONTENT', 'IMPERSONATION', 'OTHER'] as const
const reasonLabels = {
  SPAM: 'alert_wall.reason.spam',
  HARASSMENT: 'alert_wall.reason.harassment',
  ILLEGAL_CONTENT: 'alert_wall.reason.illegal_content',
  IMPERSONATION: 'alert_wall.reason.impersonation',
  OTHER: 'alert_wall.reason.other',
} as const
type TProps = { target: AlertReportTargetInput }

/** Submits an authenticated report through AlertWall's report command. */
export default function ReportAction({ target }: TProps) {
  const { t } = useTrans()
  const account = useAccount()
  const client = useQueryClient()
  const [open, setOpen] = useState(false)
  const [reportType, setReportType] = useState<(typeof reportTypes)[number]>('SPAM')
  const [details, setDetails] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const commandId = useRef<string | null>(null)
  const report = useMutation({
    mutationFn: () =>
      browserGraphQLRequest(submitReport, {
        commandId: (commandId.current ??= crypto.randomUUID()),
        input: { target, reportType, details: details.trim() || null },
      }),
    onSuccess: async () => {
      commandId.current = null
      setDetails('')
      setSubmitted(true)
      setOpen(false)
      await invalidatePrefix(
        client,
        viewerQueryKeys.myReportsPrefix(account.accountRef || 'anonymous'),
      )
    },
  })

  const openForm = () => {
    if (!account.isLogin) return authWarn()
    setOpen((value) => !value)
  }

  return (
    <div className='my-3'>
      {submitted ? (
        <span className='text-digest text-sm'>{t('alert_wall.report_submitted')}</span>
      ) : (
        <button type='button' className='text-digest text-sm underline' onClick={openForm}>
          {t('alert_wall.report')}
        </button>
      )}
      {open && (
        <form
          className='border-divider mt-3 grid gap-3 rounded-lg border p-4'
          onSubmit={(event) => {
            event.preventDefault()
            report.mutate()
          }}
        >
          <label className='grid gap-1 text-sm'>
            {t('alert_wall.report_reason')}
            <select
              className='border-divider rounded-md border bg-transparent px-3 py-2'
              value={reportType}
              disabled={report.isPending}
              onChange={(event) =>
                setReportType(event.target.value as (typeof reportTypes)[number])
              }
            >
              {reportTypes.map((value) => (
                <option key={value} value={value}>
                  {t(reasonLabels[value])}
                </option>
              ))}
            </select>
          </label>
          <label className='grid gap-1 text-sm'>
            {t('alert_wall.report_details')}
            <textarea
              className='border-divider min-h-20 rounded-md border bg-transparent p-3'
              maxLength={2000}
              value={details}
              disabled={report.isPending}
              onChange={(event) => setDetails(event.target.value)}
            />
          </label>
          {report.isError && (
            <p role='alert' className='text-sm text-red-600'>
              {t('alert_wall.report_error')}
            </p>
          )}
          <div className='flex gap-2'>
            <button
              type='submit'
              className='bg-primary text-primary-foreground rounded-md px-3 py-2 text-sm disabled:opacity-50'
              disabled={report.isPending}
            >
              {report.isPending ? t('alert_wall.report_sending') : t('alert_wall.report_submit')}
            </button>
            <button
              type='button'
              className='border-divider rounded-md border px-3 py-2 text-sm'
              onClick={() => {
                commandId.current = null
                report.reset()
                setOpen(false)
              }}
            >
              {t('alert_wall.report_cancel')}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
