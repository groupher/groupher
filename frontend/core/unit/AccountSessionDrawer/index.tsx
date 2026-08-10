'use client'

import { useCallback, useEffect, useState } from 'react'

import {
  listSessions,
  revokeOtherSessions,
  revokeSession,
  type TBrowserSessionSummary,
} from '~/auth'
import DesktopSVG from '~/icons/Desktop'
import Drawer from '~/ui/Drawer'

import useSalon from './salon'

type TProps = {
  show: boolean
  onClose: () => void
}

const formatTimestamp = (value?: string | null): string | null => {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    date,
  )
}

export default function AccountSessionDrawer({ show, onClose }: TProps) {
  const s = useSalon()
  const [sessions, setSessions] = useState<TBrowserSessionSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [pendingRef, setPendingRef] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setSessions(await listSessions())
    } catch {
      setError('Could not load your signed-in devices. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (show) void load()
  }, [load, show])

  const revoke = async (publicRef: string) => {
    setPendingRef(publicRef)
    setError(null)
    try {
      await revokeSession(publicRef)
      setSessions((current) => current.filter((session) => session.publicRef !== publicRef))
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
      setSessions((current) => current.filter((session) => session.isCurrent))
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
              loading || pendingRef !== null || sessions.every((session) => session.isCurrent)
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
    </Drawer>
  )
}
