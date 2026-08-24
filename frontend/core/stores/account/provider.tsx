'use client'

import type { ReactNode } from 'react'

import { SessionSeedContext } from './context'
import type { TInit } from './spec'

type TProps = {
  children: ReactNode
  initData?: TInit
}

export default function Provider({ children, initData }: TProps) {
  return (
    <SessionSeedContext.Provider value={initData ?? { loading: true, user: null }}>
      {children}
    </SessionSeedContext.Provider>
  )
}
