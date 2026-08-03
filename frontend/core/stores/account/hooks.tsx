'use client'

import { GROUPHER_AUTH_TOKEN_COOKIE } from '@groupher/contracts/auth'
import { useEffect } from 'react'

import EVENT from '~/const/event'
import useEvent from '~/hooks/useEvent'
import useQuery from '~/hooks/useQuery'
import type { TUser } from '~/spec'

import { me } from '../../schemas/pages/user'
import createStoreHook from '../createStoreHook'
import { StoreContext } from './context'

const useBaseStore = createStoreHook(StoreContext)

type TMeQuery = {
  me?: TUser | null
}

const hasAuthTokenCookie = (): boolean => {
  if (typeof document === 'undefined') return false

  return document.cookie
    .split(';')
    .map((item) => item.trim())
    .some((item) => item.startsWith(`${GROUPHER_AUTH_TOKEN_COOKIE}=`))
}

export default function Hooks() {
  const storeHook = useBaseStore()
  const store = storeHook.live$
  const shouldFetchMe = hasAuthTokenCookie()

  const { data, loading, error } = useQuery<TMeQuery>(me, {}, { pause: !shouldFetchMe })

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
      store.commit({ user: null, loading: false })
      return
    }

    if (error) {
      store.commit({ loading: false })
      return
    }

    store.commit({ loading })

    if (!loading) {
      store.commit({ user: data?.me })
    }
  }, [shouldFetchMe, loading, error, data, store])

  return storeHook
}
