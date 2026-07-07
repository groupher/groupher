'use client'

import { createContext, type ReactNode, useContext } from 'react'

type TProps = {
  children: ReactNode
  initialNow?: number | null
}

const InitialNowContext = createContext<number | null>(null)

/**
 * Provides the server-captured timestamp used by relative-time rendering.
 */
export const InitialNowProvider = ({ children, initialNow }: TProps) => {
  return (
    <InitialNowContext.Provider value={initialNow ?? null}>{children}</InitialNowContext.Provider>
  )
}

/**
 * Reads the stable initial timestamp for components that format relative time.
 */
export default function useInitialNow(): number | null {
  return useContext(InitialNowContext)
}
