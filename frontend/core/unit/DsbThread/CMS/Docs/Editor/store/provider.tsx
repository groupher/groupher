'use client'

import { type ReactNode, useState } from 'react'

import setupStore from '.'
import { StoreContext } from './context'
import type { TInit, TStore } from './spec'

type TProps = {
  children: ReactNode
  initData?: TInit
}

export default function Provider({ children, initData = {} }: TProps) {
  const [store] = useState<TStore>(() => setupStore(initData))

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
}
