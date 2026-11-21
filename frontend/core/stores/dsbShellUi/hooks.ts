'use client'

import { useSnapshot } from 'valtio'

import { useDsbShellStore } from '~/stores/dsbShell/hooks'

/** Reads Dash-only shell UI state backed by the DsbEditor session store. */
export default function useDsbShellUi() {
  const store = useDsbShellStore()

  return useSnapshot(store.ui)
}
