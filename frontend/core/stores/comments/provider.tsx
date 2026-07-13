'use client'

import { type ReactNode, useRef } from 'react'

import setupStore from '.'
import { StoreContext } from './context'
import type { TInit, TStore } from './spec'

type TProps = {
  children: ReactNode
  initData?: TInit
}

export default function Provider({ children, initData }: TProps) {
  const storeRef = useRef<TStore | null>(null)

  storeRef.current ??= setupStore(initData)

  return <StoreContext.Provider value={storeRef.current}>{children}</StoreContext.Provider>
}
