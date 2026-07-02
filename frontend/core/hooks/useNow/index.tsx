'use client'

import { createContext, type ReactNode, useContext } from 'react'

type TProps = {
  children: ReactNode
  initialNow?: number | null
}

const NowContext = createContext<number | null>(null)

export const NowProvider = ({ children, initialNow }: TProps) => {
  return <NowContext.Provider value={initialNow ?? null}>{children}</NowContext.Provider>
}

export default function useNow(): number | null {
  return useContext(NowContext)
}
