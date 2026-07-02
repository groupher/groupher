'use client'

import { createContext, type ReactNode, useContext } from 'react'

type TProps = {
  children: ReactNode
  initialNow?: number | null
}

const InitialNowContext = createContext<number | null>(null)

export const InitialNowProvider = ({ children, initialNow }: TProps) => {
  return (
    <InitialNowContext.Provider value={initialNow ?? null}>{children}</InitialNowContext.Provider>
  )
}

export default function useInitialNow(): number | null {
  return useContext(InitialNowContext)
}
