'use client'

import { useEffect } from 'react'
import EVENT from '~/const/event'
import useEvent from '~/hooks/useEvent'
import useQuery from '~/hooks/useQuery'
import { P } from '~/schemas'
import createStoreHook from '../createStoreHook'
import { StoreContext } from './provider'

const useBaseStore = createStoreHook(StoreContext)

export default function Hooks() {
  const storeHook = useBaseStore()
  const store = storeHook.live$

  const { data, loading, error } = useQuery(P.me, {})

  // Keep client state in sync during logout before the next refresh lands.
  // Without this, auth-sensitive widgets can briefly render the old login state.
  useEvent(EVENT.LOGOUT, () => {
    store.commit({ user: null, loading: false })
  }, [store])

  useEffect(() => {
    if (error) {
      store.commit({ loading: false })
      return
    }

    store.commit({ loading })

    if (!loading) {
      store.commit({ user: data?.me })
    }
  }, [loading, error, data, store])

  return storeHook
}
