'use client'

import { useContext } from 'react'
import { useSnapshot } from 'valtio'

import { StoreContext } from './provider'

export default () => {
  const store = useContext(StoreContext)
  if (!store) {
    throw new Error('useStore must be used within a Community store provider')
  }

  const snap = useSnapshot(store)

  return {
    ...snap,
    commit: store.commit,
    $store: store,
  }
}
