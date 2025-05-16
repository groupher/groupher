'use client'

import { useRef, type ReactNode } from 'react'

import type { TRootStore, TRootStoreInit } from './spec'

import { StoreContext, setupRootStore } from '.'

type TProps = {
  children: ReactNode
  initData: TRootStoreInit
}

export default ({ children, initData }: TProps) => {
  const storeRef = useRef<TRootStore>()

  if (!storeRef.current) {
    storeRef.current = setupRootStore(initData)
  }

  return <StoreContext.Provider value={storeRef.current}>{children}</StoreContext.Provider>
}
