import { useEffect, useRef, useState } from 'react'

import { invalidateAuthState, refreshSession, requestLogin } from '~/auth'

import {
  hasAuthRouteRecoveryAttempt,
  markAuthRouteRecoveryAttempt,
} from '../utils/auth-route-recovery'

type TRecoveryAttempt = {
  clearStateOnLogin: boolean
  loginRequested: boolean
  promise: Promise<boolean>
  reloadRequested: boolean
}

let activeRecovery: TRecoveryAttempt | null = null
const startRecovery = (shouldRefresh: boolean): TRecoveryAttempt => {
  if (activeRecovery) return activeRecovery

  const attempt = {
    clearStateOnLogin: shouldRefresh,
    loginRequested: false,
    promise: Promise.resolve(false),
    reloadRequested: false,
  } satisfies TRecoveryAttempt

  attempt.promise = (
    shouldRefresh
      ? refreshSession()
          .then(() => true)
          .catch(() => false)
      : Promise.resolve(false)
  ).finally(() => {
    if (activeRecovery === attempt) activeRecovery = null
  })
  activeRecovery = attempt
  return attempt
}

export default function AuthRouteRecovery() {
  const attempted = useRef(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (attempted.current) return
    attempted.current = true

    let active = true
    const href = window.location.href
    const shouldRefresh = !hasAuthRouteRecoveryAttempt(href)
    if (shouldRefresh) markAuthRouteRecoveryAttempt(href)
    const attempt = startRecovery(shouldRefresh)

    void attempt.promise.then((recovered) => {
      if (recovered) {
        if (attempt.reloadRequested) return
        attempt.reloadRequested = true
        window.location.reload()
        return
      }

      if (attempt.loginRequested) return
      attempt.loginRequested = true
      if (attempt.clearStateOnLogin) invalidateAuthState()
      requestLogin({ returnTo: href })
      if (active) setFailed(true)
    })

    return () => {
      active = false
    }
  }, [])

  return (
    <div className='column-center min-h-80 w-full justify-center px-6 py-12' role='status'>
      <div className='column w-full max-w-md items-start rounded-xl bg-white p-6 shadow-sm dark:bg-neutral-900'>
        <h1 className='text-lg font-semibold text-balance text-neutral-900 dark:text-neutral-100'>
          {failed ? 'Sign in to continue' : 'Restoring your session…'}
        </h1>
        <p className='mt-2 text-sm leading-6 text-pretty text-neutral-500 dark:text-neutral-400'>
          {failed
            ? 'Your browser session is no longer available.'
            : 'Your dashboard will resume automatically.'}
        </p>
      </div>
    </div>
  )
}
