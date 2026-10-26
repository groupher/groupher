import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import useTrans from '~/hooks/useTrans'
import { dsbRoutes, Link as PlatformLink } from '~/platform'
import { invalidateExact } from '~/query/invalidation/executor'
import useAccount from '~/stores/account/hooks'

import ItemReports from './ItemReports'
import { alertItems, resolveAlertItem } from './schema'

/** Shows risk items and only records a Wall-level resolution. */
export default function AlertWall({ community }: { community?: string }) {
  const { t } = useTrans()
  const { accountScope } = useAccount()
  const client = useQueryClient()
  const commandId = useRef<string | null>(null)
  const [page, setPage] = useState(1)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyPage, setHistoryPage] = useState(1)
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null)
  const scope = community
    ? { type: 'COMMUNITY' as const, community }
    : { type: 'PLATFORM' as const }
  const queryKey = ['alert-wall', accountScope || 'anonymous', community || 'platform', page]
  const items = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await browserGraphQLRequest(alertItems, {
        scope,
        pagi: { offset: { page, size: 50 } },
      })
      return response.alertItems
    },
  })
  const history = useQuery({
    queryKey: [
      'alert-wall-history',
      accountScope || 'anonymous',
      community || 'platform',
      historyPage,
    ],
    queryFn: async () => {
      const response = await browserGraphQLRequest(alertItems, {
        scope,
        filter: { closed: true },
        pagi: { offset: { page: historyPage, size: 50 } },
      })
      return response.alertItems
    },
    enabled: historyOpen,
  })
  const resolve = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      browserGraphQLRequest(resolveAlertItem, {
        id,
        resolution: 'reviewed',
        expectedVersion: version,
        commandId: (commandId.current ??= crypto.randomUUID()),
      }),
    onSuccess: async () => {
      commandId.current = null
      await invalidateExact(client, [{ queryKey }])
    },
  })

  return (
    <section className='mx-auto max-w-5xl px-5 py-8'>
      <header className='mb-5 flex items-center justify-between gap-3'>
        <h1 className='text-xl font-semibold'>{t('alert_wall.title')}</h1>
        <nav className='flex gap-4 text-sm'>
          {community && (
            <PlatformLink
              className='underline'
              route={dsbRoutes.section({ community, section: 'review-queue', search: {} })}
              navigation='router'
            >
              {t('cms_review.pending_title')}
            </PlatformLink>
          )}
          {community && (
            <PlatformLink
              className='underline'
              route={dsbRoutes.section({ community, section: 'review-bot', search: {} })}
              navigation='router'
            >
              {t('review_bot.settings')}
            </PlatformLink>
          )}
        </nav>
      </header>
      {items.isPending ? (
        <p className='text-digest text-sm'>{t('alert_wall.loading')}</p>
      ) : items.isError ? (
        <p role='alert' className='text-sm text-red-600'>
          {t('alert_wall.load_error')}
        </p>
      ) : items.data.entries.length === 0 ? (
        <p className='border-divider text-digest rounded-lg border p-5 text-sm'>
          {t('alert_wall.empty')}
        </p>
      ) : (
        <ul className='divide-divider border-divider divide-y rounded-lg border'>
          {items.data.entries.map((item) => (
            <li key={item.id} className='grid gap-3 p-4'>
              <div className='flex items-start justify-between gap-4'>
                <div>
                  <p className='font-medium'>
                    {item.targetType.toLowerCase()} · {item.targetId}
                  </p>
                  <p className='text-digest mt-1 text-sm'>
                    {item.summary || item.susNotes.map((note) => note.explanation).join(' · ')}
                  </p>
                  {item.reportCount > 0 && (
                    <button
                      type='button'
                      className='text-digest mt-1 text-xs underline'
                      aria-expanded={expandedItemId === item.id}
                      onClick={() => setExpandedItemId(expandedItemId === item.id ? null : item.id)}
                    >
                      {t('alert_wall.reports')} ({item.reportCount})
                    </button>
                  )}
                </div>
                <button
                  type='button'
                  className='border-divider shrink-0 rounded-md border px-3 py-2 text-sm disabled:opacity-50'
                  disabled={resolve.isPending}
                  onClick={() => resolve.mutate({ id: item.id, version: item.version })}
                >
                  {t('alert_wall.mark_reviewed')}
                </button>
              </div>
              {expandedItemId === item.id && <ItemReports itemId={item.id} />}
              {resolve.isError && (
                <p role='alert' className='text-sm text-red-600'>
                  {t('alert_wall.resolve_error')}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {items.data?.pageInfo &&
        'totalPages' in items.data.pageInfo &&
        items.data.pageInfo.totalPages > 1 && (
          <nav
            aria-label={t('alert_wall.queue_pagination')}
            className='mt-4 flex items-center justify-end gap-3'
          >
            <button
              type='button'
              className='border-divider rounded-md border px-3 py-2 text-sm disabled:opacity-50'
              disabled={!items.data.pageInfo.hasPreviousPage || items.isFetching}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              {t('alert_wall.previous_page')}
            </button>
            <span className='text-digest text-sm'>
              {page} / {items.data.pageInfo.totalPages}
            </span>
            <button
              type='button'
              className='border-divider rounded-md border px-3 py-2 text-sm disabled:opacity-50'
              disabled={!items.data.pageInfo.hasNextPage || items.isFetching}
              onClick={() => setPage((current) => current + 1)}
            >
              {t('alert_wall.next_page')}
            </button>
          </nav>
        )}
      <div className='border-divider mt-8 border-t pt-4'>
        <button
          type='button'
          className='text-sm underline'
          onClick={() => setHistoryOpen((open) => !open)}
          aria-expanded={historyOpen}
        >
          {t('alert_wall.history')}
        </button>
        {historyOpen && (
          <div className='mt-4'>
            {history.isPending ? (
              <p className='text-digest text-sm'>{t('alert_wall.loading')}</p>
            ) : history.isError ? (
              <p role='alert' className='text-sm text-red-600'>
                {t('alert_wall.load_error')}
              </p>
            ) : history.data.entries.length === 0 ? (
              <p className='text-digest text-sm'>{t('alert_wall.empty_history')}</p>
            ) : (
              <ul className='divide-divider border-divider divide-y rounded-lg border'>
                {history.data.entries.map((item) => (
                  <li key={item.id} className='p-4'>
                    <p className='font-medium'>
                      {item.targetType.toLowerCase()} · {item.targetId}
                    </p>
                    <p className='text-digest mt-1 text-sm'>
                      {item.status === 'SUPERSEDED'
                        ? t('cms_review.outdated')
                        : t('alert_wall.report_resolved')}{' '}
                      · {item.summary || item.susNotes.map((note) => note.explanation).join(' · ')}
                    </p>
                    {item.totalReportCount > 0 && (
                      <button
                        type='button'
                        className='text-digest mt-1 text-xs underline'
                        aria-expanded={expandedItemId === item.id}
                        onClick={() =>
                          setExpandedItemId(expandedItemId === item.id ? null : item.id)
                        }
                      >
                        {t('alert_wall.reports')} ({item.totalReportCount})
                      </button>
                    )}
                    {expandedItemId === item.id && <ItemReports itemId={item.id} />}
                  </li>
                ))}
              </ul>
            )}
            {history.data?.pageInfo &&
              'totalPages' in history.data.pageInfo &&
              history.data.pageInfo.totalPages > 1 && (
                <nav className='mt-4 flex justify-end gap-3 text-sm'>
                  <button
                    type='button'
                    className='underline disabled:opacity-50'
                    disabled={!history.data.pageInfo.hasPreviousPage || history.isFetching}
                    onClick={() => setHistoryPage((current) => Math.max(1, current - 1))}
                  >
                    {t('alert_wall.previous_page')}
                  </button>
                  <span>
                    {historyPage} / {history.data.pageInfo.totalPages}
                  </span>
                  <button
                    type='button'
                    className='underline disabled:opacity-50'
                    disabled={!history.data.pageInfo.hasNextPage || history.isFetching}
                    onClick={() => setHistoryPage((current) => current + 1)}
                  >
                    {t('alert_wall.next_page')}
                  </button>
                </nav>
              )}
          </div>
        )}
      </div>
    </section>
  )
}
