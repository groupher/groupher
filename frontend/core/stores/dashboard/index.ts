import { proxy } from 'valtio'
import METRIC from '~/const/metric'
import { CHANGE_MODE } from '~/const/mode'
import { EMPTY_PAGED_ARTICLES, EMPTY_PAGED_COMMUNITIES } from '~/const/utils'
import { DEFAULT_OVERVIEW, FIELDS } from './constant'
import type { TDsbFieldMap, TInit, TStore } from './spec'

export default (init: TInit = {}): TStore => {
  const states = Object.assign(
    {
      metric: METRIC.COMMUNITY,
      now: 0,
      ...FIELDS,

      // UI status
      initFilled: false,
      original: FIELDS as TDsbFieldMap,
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
      debug() {
        store.editingLink = null
        store.headerLinks = []
      },
    },
    init,
  )

  const store = proxy(states)
  return store
}
