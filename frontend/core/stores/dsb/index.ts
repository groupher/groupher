import { proxy } from 'valtio'

import { INIT_KANBAN_BOARDS } from '~/const/dashboard'
import METRIC from '~/const/metric'
import { CHANGE_MODE } from '~/const/mode'

import { createDraftFieldActions } from '../draftFields'
import { FIELDS } from './constant'
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

export default function DsbStore(init: TInit = {}): TStore {
  const states = Object.assign(
    {
      metric: METRIC.COMMUNITY,
      ...FIELDS,

      // UI status
      initFilled: false,
      original: FIELDS as TDsbFieldMap,
      // Fields that are currently different from original.
      touchedFields: {} as TDsbTouchedFields,
      savingField: null,
      saving: false,
      loading: false,
      submenuCollapsed: false,

      editingTag: null,
      settingTag: null,
      editingAlias: null,
      editingLink: null,
      editingLinkMode: CHANGE_MODE.CREATE,
      editingGroup: null,
      editingGroupIndex: null,
      docFaqSaveZone: null,
      queryingMediaReportIndex: null,
      demoAlertEnable: false,
      activeModerator: null,
      allModeratorRules: '{}',
      allRootRules: '{}',

      commit(patch: Partial<TStore>): void {
        Object.assign(store, patch)
      },
      ...createDraftFieldActions<TDsbFieldMap>(() => store),
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
