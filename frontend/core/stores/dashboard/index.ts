import { equals } from 'ramda'
import { proxy } from 'valtio'

import { INIT_KANBAN_BOARDS } from '~/const/dashboard'
import METRIC from '~/const/metric'
import { CHANGE_MODE } from '~/const/mode'
import { EMPTY_PAGED_ARTICLES, EMPTY_PAGED_COMMUNITIES } from '~/const/utils'

import { DEFAULT_OVERVIEW, FIELDS } from './constant'
import type { TDsbFieldMap, TDsbStoreFieldKey, TDsbTouchedFields, TInit, TStore } from './spec'

const STORE_FIELD_KEYS = Object.keys(FIELDS) as TDsbStoreFieldKey[]

// Build an original baseline from persisted dashboard fields only.
// Runtime UI fields such as loading/editing states must not be copied into original.
const pickStoreFields = (source: Record<TDsbStoreFieldKey, unknown>): TDsbFieldMap => {
  const fields = {} as TDsbFieldMap
  const mutableFields = fields as Record<TDsbStoreFieldKey, unknown>

  for (const field of STORE_FIELD_KEYS) {
    mutableFields[field] = source[field]
  }

  return fields
}

export default function DashboardStore(init: TInit = {}): TStore {
  const states = Object.assign(
    {
      metric: METRIC.COMMUNITY,
      now: 0,
      ...FIELDS,

      // UI status
      initFilled: false,
      original: FIELDS as TDsbFieldMap,
      // Fields that are currently different from original.
      touchedFields: {} as TDsbTouchedFields,
      savingField: null,
      saving: false,
      loading: false,

      overview: DEFAULT_OVERVIEW,
      editingTag: null,
      settingTag: null,
      editingAlias: null,
      editingLink: null,
      editingLinkMode: CHANGE_MODE.CREATE,
      editingGroup: null,
      editingGroupIndex: null,
      editingFAQIndex: null,
      editingFAQ: null,
      queryingMediaReportIndex: null,
      batchSelectedIDs: [],
      pagedCommunities: EMPTY_PAGED_COMMUNITIES,
      pagedPosts: EMPTY_PAGED_ARTICLES,
      pagedDocs: EMPTY_PAGED_ARTICLES,
      pagedChangelogs: EMPTY_PAGED_ARTICLES,
      demoAlertEnable: false,
      activeModerator: null,
      allModeratorRules: '{}',
      allRootRules: '{}',

      commit(patch: Partial<TStore>): void {
        Object.assign(store, patch)
      },
      editField<K extends TDsbStoreFieldKey>(field: K, value: TDsbFieldMap[K]): void {
        const storeFields = store as unknown as Record<TDsbStoreFieldKey, unknown>
        storeFields[field] = value

        if (equals(value, store.original[field])) {
          const { [field]: _removed, ...rest } = store.touchedFields
          store.touchedFields = rest
          return
        }

        store.touchedFields = { ...store.touchedFields, [field]: true }
      },
      editFields(patch: Partial<TDsbFieldMap>): void {
        for (const field of Object.keys(patch) as TDsbStoreFieldKey[]) {
          const value = patch[field]
          if (value !== undefined) {
            store.editField(field, value)
          }
        }
      },
      markFieldsToOriginal(fields: readonly TDsbStoreFieldKey[]): void {
        const originalPatch = {} as Partial<TDsbFieldMap>
        const mutableOriginalPatch = originalPatch as Record<TDsbStoreFieldKey, unknown>
        const storeFields = store as unknown as Record<TDsbStoreFieldKey, unknown>
        let touchedFields = store.touchedFields

        for (const field of fields) {
          mutableOriginalPatch[field] = storeFields[field]
          const { [field]: _removedTouched, ...nextTouchedFields } = touchedFields
          touchedFields = nextTouchedFields
        }

        store.original = { ...store.original, ...originalPatch }
        store.touchedFields = touchedFields
      },
      rollbackFields(fields: readonly TDsbStoreFieldKey[]): void {
        const storeFields = store as unknown as Record<TDsbStoreFieldKey, unknown>
        let touchedFields = store.touchedFields

        for (const field of fields) {
          storeFields[field] = store.original[field]
          const { [field]: _removedTouched, ...nextTouchedFields } = touchedFields
          touchedFields = nextTouchedFields
        }

        store.touchedFields = touchedFields
      },
      isTouched(field: TDsbStoreFieldKey): boolean {
        return Boolean(store.touchedFields[field])
      },
      anyTouched(fields: readonly TDsbStoreFieldKey[]): boolean {
        return fields.some((field) => store.isTouched(field))
      },
      debug() {
        store.editingLink = null
        store.headerLinks = []
      },
    },
    init,
  )

  if (!states.kanbanBoards?.length) {
    states.kanbanBoards = INIT_KANBAN_BOARDS
  }

  if (!init.original) {
    states.original = pickStoreFields(states)
  }

  if (!states.original?.kanbanBoards?.length) {
    states.original = { ...states.original, kanbanBoards: INIT_KANBAN_BOARDS }
  }

  const store = proxy(states)
  return store
}
