'use client'

import { createContext, type ReactNode, useEffect, useRef } from 'react'

import setupStore from '.'
import type { TInit, TStore } from './spec'

type TProps = {
  children: ReactNode
  initData: TInit
}

export const StoreContext = createContext<TStore | null>(null)
StoreContext.displayName = 'DocsEditor'

export default function Provider({ children, initData }: TProps) {
  const storeRef = useRef<TStore | null>(null)

  storeRef.current ??= setupStore(initData)

  useEffect(() => {
    storeRef.current?.attachSideTree(initData.sideTree)
  }, [initData.sideTree])

  return <StoreContext.Provider value={storeRef.current}>{children}</StoreContext.Provider>
}
