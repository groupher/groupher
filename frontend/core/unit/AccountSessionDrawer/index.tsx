import { useQuery, useQueryClient } from '@tanstack/react-query'

import usePagiPosition from '~/hooks/usePagiPosition'
import { viewerQueryKeys } from '~/query'
import { invalidatePrefix } from '~/query/invalidation'
import useAccount from '~/stores/account/hooks'
import Pagi from '~/ui/Pagi'
;('use client')

import { useState } from 'react'

import { listSessions, revokeOtherSessions, revokeSession } from '~/auth'
import DesktopSVG from '~/icons/Desktop'
import Drawer from '~/ui/Drawer'

import useSalon from './salon'

type TProps = {
  show: boolean
  onClose: () => void
}

const timestampFormat = new Intl.DateTimeFormat(undefined, {
  dateStyle: 'medium',
  timeStyle: 'short',
})

const formatTimestamp = (value?: string | null): string | null => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return timestampFormat.format(date)
}

export default function AccountSessionDrawer({ show, onClose }: TProps) {
  const s = useSalon()
  const { accountScope } = useAccount()
  const client = useQueryClient()
  const position = usePagiPosition(`account-sessions:${accountScope}`)
  const query = useQuery({
    queryKey: [...viewerQueryKeys.all, accountScope, 'sessions', position.input],
    queryFn: () => listSessions(position.input),
    enabled: show && !!accountScope,
  })
  const sessions = query.data?.entries ?? []
  const loading = query.isFetching
  const [pendingRef, setPendingRef] = useState<string | null>(null)
  const [actionError, setError] = useState<string | null>(null)
  const error =
    actionError ?? (query.error ? 'Could not load your signed-in devices. Please try again.' : null)
  const load = query.refetch

  const revoke = async (publicRef: string) => {
    setPendingRef(publicRef)
    setError(null)
    try {
      await revokeSession(publicRef)
      await invalidatePrefix(client, [...viewerQueryKeys.all, accountScope, 'sessions'])
    } catch {
      setError('Could not revoke that device. Please try again.')
    } finally {
      setPendingRef(null)
    }
  }

  const revokeOthers = async () => {
    setPendingRef('others')
    setError(null)
    try {
      await revokeOtherSessions()
      await invalidatePrefix(client, [...viewerQueryKeys.all, accountScope, 'sessions'])
      position.reset()
    } catch {
      setError('Could not revoke the other devices. Please try again.')
    } finally {
      setPendingRef(null)
    }
  }

  return (
    <Drawer show={show} onClose={onClose}>
      <div className={s.wrapper}>
        <header className={s.header}>
          <h2 className={s.title}>Login &amp; devices</h2>
          <p className={s.desc}>
            Review browsers signed in to your account and revoke anything you do not recognize.
          </p>
        </header>

        <div className={s.actions}>
          <button
            type='button'
            className={s.secondaryButton}
            disabled={loading || pendingRef !== null}
            onClick={() => void load()}
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
          <button
            type='button'
            className={s.revokeButton}
            disabled={
              loading ||
              pendingRef !== null ||
              (query.data?.pageInfo.__typename === 'OffsetPageInfo'
                ? query.data.pageInfo.totalCount <= 1
                : sessions.every((session) => session.isCurrent) &&
                  !query.data?.pageInfo.hasNextPage &&
                  !query.data?.pageInfo.hasPreviousPage)
            }
            onClick={() => void revokeOthers()}
          >
            {pendingRef === 'others' ? 'Revoking…' : 'Revoke other devices'}
          </button>
        </div>

        {error && <p className={s.error}>{error}</p>}

        <div className={s.list} aria-live='polite' aria-busy={loading}>
          {!loading && sessions.length === 0 && <div className={s.empty}>No active devices.</div>}
          {sessions.map((session) => {
            const title =
              [session.browserFamily, session.osFamily].filter(Boolean).join(' on ') ||
              session.deviceFamily ||
              'Unknown browser'
            const location =
              [session.lastSeenCity, session.lastSeenRegion, session.lastSeenCountry]
                .filter(Boolean)
                .join(', ') ||
              [session.createdCity, session.createdRegion, session.createdCountry]
                .filter(Boolean)
                .join(', ') ||
              'Unknown location'
            const signedInAt = formatTimestamp(session.insertedAt)
            const lastSeenAt = formatTimestamp(session.lastSeenAt)

            return (
              <div
                className={s.session}
                data-current-session={String(session.isCurrent)}
                data-session-ref={session.publicRef}
                data-testid='browser-session'
                key={session.publicRef}
              >
                <div className={s.iconBox}>
                  <DesktopSVG className={s.icon} />
                </div>
                <div className={s.sessionBody}>
                  <div className={s.sessionTitle}>
                    <span>{title}</span>
                    {session.isCurrent && <span className={s.current}>Current</span>}
                  </div>
                  <span className={s.meta}>{location}</span>
                  {(signedInAt || lastSeenAt) && (
                    <span className={s.meta}>
                      {signedInAt ? `Signed in ${signedInAt}` : ''}
                      {signedInAt && lastSeenAt ? ' · ' : ''}
                      {lastSeenAt ? `Last active ${lastSeenAt}` : ''}
                    </span>
                  )}
                  {session.userAgentSummary && (
                    <span className={s.meta}>{session.userAgentSummary}</span>
                  )}
                </div>
                {!session.isCurrent && (
                  <button
                    type='button'
                    className={s.revokeButton}
                    disabled={pendingRef !== null}
                    onClick={() => void revoke(session.publicRef)}
                  >
                    {pendingRef === session.publicRef ? 'Revoking…' : 'Revoke'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
      <Pagi pageInfo={query.data?.pageInfo} onChange={position.setPage} />
    </Drawer>
  )
}
