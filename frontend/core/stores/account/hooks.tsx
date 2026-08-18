'use client'

import { GROUPHER_AUTH_SIGNED_IN_COOKIE } from '@groupher/contracts/auth'
import { useEffect, useRef } from 'react'

import EVENT from '~/const/event'
import useEvent from '~/hooks/useEvent'
import useQuery from '~/hooks/useQuery'
import type { TUser } from '~/spec'

import { sessionState } from '../../schemas/pages/user'
import createStoreHook from '../createStoreHook'
import { StoreContext } from './context'

const useBaseStore = createStoreHook(StoreContext)

// This reads only the non-sensitive hint cookie. The real Phoenix token remains
// HttpOnly and is consumed by the same-origin GraphQL proxy when `me` is sent.
const hasSignedInHintCookie = (): boolean => {
  if (typeof document === 'undefined') return false

  return document.cookie
    .split(';')
    .map((item) => item.trim())
    .some((item) => item === `${GROUPHER_AUTH_SIGNED_IN_COOKIE}=1`)
}

export default function Hooks() {
  const storeHook = useBaseStore()
  const store = storeHook.live$
  const sessionProbeStarted = useRef(false)
  const shouldFetchMe = store.loading && hasSignedInHintCookie()

  const { data, loading, error } = useQuery(sessionState, {}, { pause: !shouldFetchMe })

  // Keep client state in sync during logout before the next refresh lands.
  // Without this, auth-sensitive widgets can briefly render the old login state.
  useEvent(
    EVENT.LOGOUT,
    () => {
      store.commit({ user: null, loading: false })
    },
    [store],
  )

  useEffect(() => {
    if (!shouldFetchMe) {
      // `store.loading` becomes false after the probe resolves. Do not treat
      // that post-probe render as an anonymous initial state and erase the
      // user we just received.
      if (!sessionProbeStarted.current && !store.user) {
        store.commit({ user: null, loading: false })
      }
      return
    }

    sessionProbeStarted.current = true

    if (error) {
      store.commit({ loading: false })
      return
    }

    store.commit({ loading })

    if (!loading) {
      store.commit({
        user: data?.sessionState?.isValid
          ? data.sessionState.user
            ? {
                ...data.sessionState.user,
                passport: data.sessionState.user.passport as TUser['passport'],
              }
            : null
          : null,
      })
    }
  }, [shouldFetchMe, loading, error, data, store])

  return storeHook
}
