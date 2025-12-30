'use client'

import { useContext } from 'react'
import { useSnapshot } from 'valtio'

import { StoreContext } from './provider'

export default () => {
  const store = useContext(StoreContext)
  if (!store) {
    throw new Error('useStore must be used within a Locale store provider')
  }

  const snap = useSnapshot(store)

  return {
    ...snap,
    setLocale: store.setLocale,
    setLocaleData: store.setLocaleData,
    $store: store,
  }
}
