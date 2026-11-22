'use client'

import { use, useMemo } from 'react'
import { useSnapshot } from 'valtio'

import { DSB_SHELL_ACTION_KEYS, DSB_SHELL_STATE_KEYS } from './constants'
import { DsbShellContext } from './context'
import type { TDsbShellContextValue, TDsbShellStore } from './spec'

type TFunc = (...args: unknown[]) => unknown

/** Returns the stable editable store for callbacks that must read the latest draft. */
export const useDsbShellStore = (): TDsbShellStore => {
  const context = use(DsbShellContext)
  if (!context) throw new Error('useDsbShellStore must be used within a DsbShellProvider')
  return context.editStore
}

/** Returns the current Dash editor session metadata. */
export const useDsbShellSession = (): Pick<TDsbShellContextValue, 'community' | 'demoMode'> => {
  const context = use(DsbShellContext)
  if (!context) throw new Error('useDsbShellSession must be used within a DsbShellProvider')
  return { community: context.community, demoMode: context.demoMode }
}

/** Reads the current Dash editing session and its reconcile actions. */
export default function useDsbShell(): Readonly<TDsbShellStore> {
  const store = useDsbShellStore()
  const snapshot = useSnapshot(store)
  const actions = useMemo(() => {
    const stableActions: Record<string, TFunc> = {}

    for (const key of DSB_SHELL_ACTION_KEYS) {
      stableActions[key as string] = (...args: unknown[]) => {
        const action = store[key]
        return typeof action === 'function' ? (action as TFunc)(...args) : undefined
      }
    }

    return stableActions
  }, [store])
  const result = {} as Record<string, unknown>

  // Lazy getters preserve Valtio's field-level tracking. Eager snapshot spread
  // would subscribe every Dashboard editor to every top-level config field.
  for (const key of DSB_SHELL_STATE_KEYS) {
    Object.defineProperty(result, key, {
      enumerable: true,
      get: () => snapshot[key],
    })
  }

  for (const key of DSB_SHELL_ACTION_KEYS) {
    Object.defineProperty(result, key, {
      enumerable: true,
      value: actions[key],
    })
  }

  return result as Readonly<TDsbShellStore>
}
