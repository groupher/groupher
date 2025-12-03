'use client'

import { createContext, useContext } from 'react'

import type { TRootStore } from './spec'

export { default as StoreProvider } from './provider'
export { setupRootStore } from './ssr'

export const StoreContext = createContext<TRootStore | null>(null)

export const useStore = () => {
  const store = useContext(StoreContext)
  if (!store) {
    throw new Error('useStore must be used within a StoreProvider')
  }
  return store
}
