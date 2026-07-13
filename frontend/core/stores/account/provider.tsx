'use client'

import { type ReactNode, useRef } from 'react'

import setupStore from '.'
import { StoreContext } from './context'
import type { TStore } from './spec'

type TProps = {
  children: ReactNode
}

export default function Provider({ children }: TProps) {
  const storeRef = useRef<TStore | null>(null)

  storeRef.current ??= setupStore()

  return <StoreContext.Provider value={storeRef.current}>{children}</StoreContext.Provider>
}
