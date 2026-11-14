import { clone, equals } from 'ramda'
import { proxy } from 'valtio'

import type { TDsbEditableFieldKey } from '~/spec'

import type { TDsbShellStore, TDsbEditableFields, TDsbShellUi, TDsbReconcileInput } from './spec'

const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key)

const cloneFields = (fields: TDsbEditableFields): TDsbEditableFields => clone(fields)

/** Creates the editable Dsb working copy; Query remains the confirmed-data owner. */
export const createDsbShellStore = (initial: TDsbEditableFields): TDsbShellStore => {
  let store: TDsbShellStore

  const updateTouched = (field: TDsbEditableFieldKey): void => {
    const touched = !equals(store[field], store.original[field])
    if (touched) {
      store.touchedFields = { ...store.touchedFields, [field]: true }
      return
    }

    const { [field]: _removed, ...rest } = store.touchedFields
    store.touchedFields = rest as TDsbShellStore['touchedFields']
  }

  const edit = <K extends TDsbEditableFieldKey>(field: K, value: TDsbEditableFields[K]): void => {
    const storeFields = store as unknown as Record<TDsbEditableFieldKey, unknown>
    storeFields[field] = value
    updateTouched(field)
  }

  const editMany = (patch: Partial<TDsbEditableFields>): void => {
    for (const field of Object.keys(patch) as TDsbEditableFieldKey[]) {
      if (hasOwn(patch, field) && patch[field] !== undefined) {
        edit(field as never, patch[field] as never)
      }
    }
  }

  const rollback = (fields: readonly TDsbEditableFieldKey[]): void => {
    for (const field of fields) edit(field, clone(store.original[field]))
  }

  const accept = (fields: readonly TDsbEditableFieldKey[]): void => {
    const nextOriginal = { ...store.original }
    const storeFields = store as unknown as Record<TDsbEditableFieldKey, unknown>
    for (const field of fields) {
      nextOriginal[field] = clone(storeFields[field]) as never
    }
    store.original = nextOriginal
    for (const field of fields) updateTouched(field)
  }

  const reconcile = ({ fields, submitted, confirmed }: TDsbReconcileInput): void => {
    for (const field of fields) {
      if (!hasOwn(confirmed, field) || confirmed[field] === undefined) continue

      const current = store[field]
      const submittedValue = submitted[field]
      const confirmedValue = confirmed[field] as TDsbEditableFields[typeof field]

      store.original = { ...store.original, [field]: clone(confirmedValue) }
      if (hasOwn(submitted, field) && equals(current, submittedValue)) {
        const storeFields = store as unknown as Record<TDsbEditableFieldKey, unknown>
        storeFields[field] = clone(confirmedValue)
      }
      updateTouched(field)
    }
  }

  const resetEditor = (): void => {
    store.editingTag = null
    store.settingTag = null
    store.editingAlias = null
    store.docFaqSaveZone = null
    store.activeModerator = null
  }

  const reconcileConfirmed = (confirmed: TDsbEditableFields): void => {
    const fields = Object.keys(store.original) as TDsbEditableFieldKey[]
    const nextOriginal = cloneFields(confirmed)
    const storeFields = store as unknown as Record<TDsbEditableFieldKey, unknown>

    for (const field of fields) {
      if (!hasOwn(confirmed, field)) continue
      const wasTouched = store.isTouched(field)

      if (!wasTouched) storeFields[field] = clone(confirmed[field])
    }

    store.original = nextOriginal
    for (const field of fields) updateTouched(field)
  }

  store = proxy({
    ...cloneFields(initial),
    original: cloneFields(initial),
    touchedFields: {},
    ui: {
      submenuCollapsed: false,
      setSubmenuCollapsed: (value: boolean) => {
        store.ui.submenuCollapsed = value
      },
    },
    editingTag: null,
    settingTag: null,
    editingAlias: null,
    docFaqSaveZone: null,
    activeModerator: null,
    setEditingTag: (tag) => {
      store.editingTag = tag
    },
    setSettingTag: (tag) => {
      store.settingTag = tag
    },
    setTag: (mode, tag) => {
      if (mode === 'editingTag') store.settingTag = null
      else store.editingTag = null
      store[mode] = tag
    },
    setEditingAlias: (alias) => {
      store.editingAlias = alias
    },
    setDocFaqSaveZone: (zone) => {
      store.docFaqSaveZone = zone
    },
    setActiveModerator: (user) => {
      store.activeModerator = user
    },
    resetEditor,
    edit,
    editMany,
    rollback,
    accept,
    reconcile,
    reconcileConfirmed,
    isTouched: (field: TDsbEditableFieldKey) => Boolean(store.touchedFields[field]),
    anyTouched: (fields: readonly TDsbEditableFieldKey[]) =>
      fields.some((field) => store.isTouched(field)),
  } as TDsbShellStore)

  return store
}

export type { TDsbShellStore, TDsbEditableFields, TDsbShellUi, TDsbReconcileInput }
