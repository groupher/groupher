'use client'

import { createContext, type ReactNode, useRef } from 'react'
import setupStore from '.'
import type { TStore } from './spec'

type TProps = {
  children: ReactNode
}

export const StoreContext = createContext<TStore | null>(null)

export default ({ children }: TProps) => {
  const storeRef = useRef<TStore | null>(null)

  if (!storeRef.current) {
    storeRef.current = setupStore()
  }

  return <StoreContext.Provider value={storeRef.current}>{children}</StoreContext.Provider>
}
