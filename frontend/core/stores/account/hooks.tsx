'use client'

import { useEffect } from 'react'
import useQuery from '~/hooks/useQuery'
import { P } from '~/schemas'
import createStoreHook from '../createStoreHook'
import { StoreContext } from './provider'

const useBaseStore = createStoreHook(StoreContext)

export default () => {
  const storeHook = useBaseStore()
  const store = storeHook.live$

  const { data, loading, error } = useQuery(P.me, {})

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
