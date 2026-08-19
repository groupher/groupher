import { useEffect, useRef, useState } from 'react'

import { invalidateAuthState, refreshSession, requestLogin } from '~/auth'

import { authRouteRecoveryKey } from '../utils/auth-route-recovery'

export default function AuthRouteRecovery() {
  const attempted = useRef(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (attempted.current) return
    attempted.current = true

    let active = true
    const recoveryKey = authRouteRecoveryKey(window.location.href)
    const fail = (clearState: boolean) => {
      if (clearState) {
        invalidateAuthState()
      }
      requestLogin({ returnTo: window.location.href })
      if (active) setFailed(true)
    }

    if (sessionStorage.getItem(recoveryKey) === 'attempted') {
      fail(false)
      return
    }
    sessionStorage.setItem(recoveryKey, 'attempted')

    void (async () => {
      try {
        await refreshSession()
      } catch {
        fail(true)
        return
      }

      sessionStorage.removeItem(recoveryKey)
      window.location.reload()
    })()

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
