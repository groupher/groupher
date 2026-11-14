'use client'

import { useSnapshot } from 'valtio'

import type { TChangeTagMode, TTag, TUser } from '~/spec'

import { useDsbShellStore } from './hooks'

/** Reads Tags editor selections from the Dash shell session. */
export const useTagsEditor = () => {
  const store = useDsbShellStore()
  const snapshot = useSnapshot(store)

  return {
    editingTag: snapshot.editingTag as TTag | null,
    settingTag: snapshot.settingTag as TTag | null,
    setEditingTag: store.setEditingTag,
    setSettingTag: store.setSettingTag,
    setTag: (mode: TChangeTagMode, tag: TTag | null) => store.setTag(mode, tag),
    reset: () => {
      store.setEditingTag(null)
      store.setSettingTag(null)
    },
  }
}

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
    setDocFaqSaveZone: store.setDocFaqSaveZone,
    reset: () => store.setDocFaqSaveZone(null),
  }
}

/** Reads the Admin editor selection from the Dash shell session. */
export const useAdminEditor = () => {
  const store = useDsbShellStore()
  const snapshot = useSnapshot(store)

  return {
    activeModerator: snapshot.activeModerator as TUser | null,
    setActiveModerator: store.setActiveModerator,
    reset: () => store.setActiveModerator(null),
  }
}
