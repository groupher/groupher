'use client'

import { type ReactNode, useRef } from 'react'
import { StoreContext, setupRootStore } from '.'
import type { TRootStore, TRootStoreInit } from './spec'

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
  }

  return <StoreContext.Provider value={storeRef.current}>{children}</StoreContext.Provider>
}
