'use client'

import { useQueryClient } from '@tanstack/react-query'
import { type ReactNode, useEffect, useMemo, useState } from 'react'

import { dsbKeys } from '~/query'
import type { TDsbEditableFieldKey, TDsb } from '~/spec'

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
  const queryClient = useQueryClient()
  const [editStore] = useState(() => createDsbShellStore(initialData))

  useEffect(() => {
    editStore.reconcileConfirmed(initialData)
  }, [editStore, initialData])

  useEffect(() => {
    if (!demoMode) return

    const saved = readDemoFields(community)
    const fields = Object.keys(saved).filter(
      (field) => field in editStore.original,
    ) as TDsbEditableFieldKey[]
    if (fields.length === 0) return

    editStore.editMany(saved)
    editStore.accept(fields)
    queryClient.setQueryData<TDsb>(dsbKeys.slug(community), (current) =>
      current ? { ...current, ...saved } : current,
    )
  }, [community, demoMode, editStore, queryClient])

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
