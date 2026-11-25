'use client'

import { type ReactNode, useLayoutEffect, useState } from 'react'

import setupStore from '.'
import { StoreContext } from './context'
import type { TInit, TStore } from './spec'

type TProps = {
  children: ReactNode
  initData: TInit
}

export default function Provider({ children, initData }: TProps) {
  const [store] = useState<TStore>(() => setupStore(initData))

  useLayoutEffect(() => {
    store.setLocaleData(initData.localeData)
    store.setLocale(initData.locale)
    store.setRouteOverride(Boolean(initData.routeOverride))
  }, [initData.locale, initData.localeData, initData.routeOverride, store])

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}
