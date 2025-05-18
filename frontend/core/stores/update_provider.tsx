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
  // const store = useStore()
  // console.log('## cur store: ', store)

  if (!storeRef.current) {
    storeRef.current = setupRootStore(initData)
    // console.log('## after setup: ', storeRef.current)
  }

  return <StoreContext.Provider value={storeRef.current}>{children}</StoreContext.Provider>
}
