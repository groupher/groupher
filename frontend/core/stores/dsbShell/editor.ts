'use client'

import { useSnapshot } from 'valtio'

import type { TAdmin } from '~/spec'

import { useDsbShellStore } from './hooks'

/** Reads the Alias editor selection from the Dash shell session. */
export const useAliasEditor = () => {
  const store = useDsbShellStore()
  const snapshot = useSnapshot(store)

  return {
    editingAlias: snapshot.editingAlias,
    setEditingAlias: store.setEditingAlias,
    reset: () => store.setEditingAlias(null),
  }
}

/** Reads the FAQ save-zone selection from the Dash shell session. */
export const useFaqEditorState = () => {
  const store = useDsbShellStore()
  const snapshot = useSnapshot(store)

  return {
    docFaqSaveZone: snapshot.docFaqSaveZone,
    docFaqSaveSession: snapshot.docFaqSaveSession,
    setDocFaqSaveZone: store.setDocFaqSaveZone,
    reset: () => store.setDocFaqSaveZone(null),
  }
}

/** Reads the Admin editor selection from the Dash shell session. */
export const useAdminEditor = () => {
  const store = useDsbShellStore()
  const snapshot = useSnapshot(store)

  return {
    activeAdmin: snapshot.activeAdmin as TAdmin | null,
    setActiveAdmin: store.setActiveAdmin,
    reset: () => store.setActiveAdmin(null),
  }
}
