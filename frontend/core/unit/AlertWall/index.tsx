import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useRef } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import useTrans from '~/hooks/useTrans'
import { dsbRoutes, Link as PlatformLink } from '~/platform'
import { invalidateExact } from '~/query/invalidation/executor'
import useAccount from '~/stores/account/hooks'

import { alertItems, resolveAlertItem } from './schema'

/** Shows risk items and only records a Wall-level resolution. */
export default function AlertWall({ community }: { community?: string }) {
  const { t } = useTrans()
  const { accountRef } = useAccount()
  const client = useQueryClient()
  const commandId = useRef<string | null>(null)
  const scope = community
    ? { type: 'COMMUNITY' as const, community }
    : { type: 'PLATFORM' as const }
  const queryKey = ['alert-wall', accountRef || 'anonymous', community || 'platform']
  const items = useQuery({
    queryKey,
    queryFn: async () =>
      (await browserGraphQLRequest(alertItems, { scope, pagi: { offset: { page: 1, size: 50 } } }))
        .alertItems.entries,
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
      ) : items.data.length === 0 ? (
        <p className='border-divider text-digest rounded-lg border p-5 text-sm'>
          {t('alert_wall.empty')}
        </p>
      ) : (
        <ul className='divide-divider border-divider divide-y rounded-lg border'>
          {items.data.map((item) => (
            <li key={item.id} className='grid gap-3 p-4'>
              <div className='flex items-start justify-between gap-4'>
                <div>
                  <p className='font-medium'>
                    {item.targetType.toLowerCase()} · {item.targetId}
                  </p>
                  <p className='text-digest mt-1 text-sm'>
                    {item.summary || item.susNotes.map((note) => note.explanation).join(' · ')}
                  </p>
                  <p className='text-digest mt-1 text-xs'>{item.reportCount} reports</p>
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
              {resolve.isError && (
                <p role='alert' className='text-sm text-red-600'>
                  {t('alert_wall.resolve_error')}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
