'use client'

import { type ReactNode, useLayoutEffect, useState } from 'react'

import setupStore from '.'
import { StoreContext } from './context'
import { readDemoWallpaper } from './demo'
import type { TInit, TStore } from './spec'

type TProps = {
  children: ReactNode
  initData?: TInit
  demoCommunity?: string
}

export default function Provider({ children, initData, demoCommunity }: TProps) {
  const [store] = useState<TStore>(() => setupStore(initData))

  useLayoutEffect(() => {
    const demoPatch = demoCommunity ? readDemoWallpaper(demoCommunity) : {}
    const confirmed = {
      ...initData,
      light: { ...initData?.light, ...demoPatch.light },
      dark: { ...initData?.dark, ...demoPatch.dark },
    }
    store.reconcileConfirmed(confirmed)
  }, [demoCommunity, initData?.dark, initData?.light, store])

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}
