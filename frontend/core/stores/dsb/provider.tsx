'use client'

import type { ReactNode } from 'react'

import type { TDsb } from '~/spec'

import { DsbContext } from './context'

type TProps = {
  children: ReactNode
  initData: TDsb
}

export default function DsbProvider({ children, initData }: TProps) {
  return <DsbContext.Provider value={initData}>{children}</DsbContext.Provider>
}
