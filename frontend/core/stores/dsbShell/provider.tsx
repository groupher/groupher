'use client'

import { type ReactNode, useLayoutEffect, useMemo, useState } from 'react'

import type { TDsb } from '~/spec'

import { createDsbShellStore } from '.'
import { DsbShellContext } from './context'
import { readDemoFields } from './demoFields'
import type { TDsbShellContextValue } from './spec'

type TProps = {
  children: ReactNode
  community: string
  demoMode: boolean
  initialData: TDsb
}

export default function DsbShellProvider({ children, community, demoMode, initialData }: TProps) {
  const [editStore] = useState(() => createDsbShellStore(initialData))

  useLayoutEffect(() => {
    const confirmed = demoMode ? { ...initialData, ...readDemoFields(community) } : initialData
    editStore.reconcileConfirmed(confirmed)
  }, [community, demoMode, editStore, initialData])

  const value = useMemo<TDsbShellContextValue>(
    () => ({
      community,
      demoMode,
      editStore,
    }),
    [community, demoMode, editStore],
  )

  return <DsbShellContext.Provider value={value}>{children}</DsbShellContext.Provider>
}
