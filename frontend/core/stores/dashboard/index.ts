import { proxy } from 'valtio'
import METRIC from '~/const/metric'
import { CHANGE_MODE } from '~/const/mode'
import {
  DSB_ALIAS_ROUTE,
  DSB_BASEINFO_ROUTE,
  DSB_BROADCAST_ROUTE,
  DSB_DOC_ROUTE,
  DSB_LAYOUT_ROUTE,
  DSB_SEO_ROUTE,
  DSB_THIRD_PART_ROUTE,
} from '~/const/route'
import { EMPTY_PAGED_ARTICLES, EMPTY_PAGED_COMMUNITIES } from '~/const/utils'
import { DEFAULT_OVERVIEW, FIELDS } from './constant'
import type { TDsbFields, TInit, TStore } from './spec'

export default (init: TInit = {}): TStore => {
  const states = Object.assign(
    {
      metric: METRIC.COMMUNITY,
      now: 0,
      ...FIELDS,

      // UI status
      initFilled: false,
      original: FIELDS as TDsbFields,
      savingField: null,
      saving: false,
      loading: false,

      // sub tabs
      curTab: null,
      baseInfoTab: DSB_BASEINFO_ROUTE.BASIC,
      aliasTab: DSB_ALIAS_ROUTE.THREAD,
      thirdPartTab: DSB_THIRD_PART_ROUTE.ANALYTICS,
      seoTab: DSB_SEO_ROUTE.SEARCH_ENGINE,
      docTab: DSB_DOC_ROUTE.TABLE,
      layoutTab: DSB_LAYOUT_ROUTE.GENERAL,
      broadcastTab: DSB_BROADCAST_ROUTE.GLOBAL,
      // sub tabs end

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
