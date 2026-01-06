'use client'

import { useContext, useEffect } from 'react'
import { useSnapshot } from 'valtio'

import useQuery from '~/hooks/useQuery'
import { P } from '~/schemas'
import { StoreContext } from './provider'

export default () => {
  const store = useContext(StoreContext)
  if (!store) {
    throw new Error('useStore must be used within a Account store provider')
  }

  const snap = useSnapshot(store)

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

  return {
    ...snap,
    $store: store,
  }
}
