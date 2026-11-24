import type {
  TChangeTagMode,
  TDocFaqSaveZone,
  TDsbEditableFieldKey,
  TDsbFieldMap,
  TNameAlias,
  TTag,
  TAdmin,
} from '~/spec'

export type TDsbEditableFields = TDsbFieldMap

export type TDsbReconcileInput = {
  fields: readonly TDsbEditableFieldKey[]
  submitted: Partial<TDsbEditableFields>
  confirmed: Partial<TDsbEditableFields>
}

export type TDsbShellUi = {
  submenuCollapsed: boolean
  setSubmenuCollapsed: (value: boolean) => void
}

export type TDsbShellStore = TDsbEditableFields & {
  original: TDsbEditableFields
  touchedFields: Partial<Record<TDsbEditableFieldKey, true>>
  ui: TDsbShellUi

  // Transient editor selections. Not persisted, not part of original/touched, and never saved.
  editingTag: TTag | null
  settingTag: TTag | null
  editingAlias: TNameAlias | null
  docFaqSaveZone: TDocFaqSaveZone
  activeAdmin: TAdmin | null
  setEditingTag: (tag: TTag | null) => void
  setSettingTag: (tag: TTag | null) => void
  setTag: (mode: TChangeTagMode, tag: TTag | null) => void
  setEditingAlias: (alias: TNameAlias | null) => void
  setDocFaqSaveZone: (zone: TDocFaqSaveZone) => void
  setActiveAdmin: (admin: TAdmin | null) => void
  resetEditor: () => void

  edit: <K extends TDsbEditableFieldKey>(field: K, value: TDsbEditableFields[K]) => void
  editMany: (patch: Partial<TDsbEditableFields>) => void
  rollback: (fields: readonly TDsbEditableFieldKey[]) => void
  accept: (fields: readonly TDsbEditableFieldKey[]) => void
  reconcile: (input: TDsbReconcileInput) => void
  reconcileConfirmed: (confirmed: TDsbEditableFields) => void
  isTouched: (field: TDsbEditableFieldKey) => boolean
  anyTouched: (fields: readonly TDsbEditableFieldKey[]) => boolean
}

export type TDsbShellContextValue = {
  community: string
  demoMode: boolean
  editStore: TDsbShellStore
}
