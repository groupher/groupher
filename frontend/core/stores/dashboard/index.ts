import { proxy } from 'valtio'
import { CHANGE_MODE } from '~/const/mode'
import {
  DASHBOARD_ALIAS_ROUTE,
  DASHBOARD_BASEINFO_ROUTE,
  DASHBOARD_BROADCAST_ROUTE,
  DASHBOARD_DOC_ROUTE,
  DASHBOARD_LAYOUT_ROUTE,
  DASHBOARD_ROUTE,
  DASHBOARD_SEO_ROUTE,
} from '~/const/route'
import { EMPTY_PAGED_ARTICLES, EMPTY_PAGED_COMMUNITIES } from '~/const/utils'
import { DEFAULT_OVERVIEW, SETTING_FIELDS } from './constant'
import type { TInit, TStore } from './spec'

export default (init: TInit = {}): TStore => {
  const states = Object.assign(
    {
      ...SETTING_FIELDS,
      curTab: DASHBOARD_ROUTE.INFO,
      initFilled: false,
      original: SETTING_FIELDS,
      savingField: null,
      saving: false,
      loading: false,
      baseInfoTab: DASHBOARD_BASEINFO_ROUTE.BASIC,
      aliasTab: DASHBOARD_ALIAS_ROUTE.THREAD,
      seoTab: DASHBOARD_SEO_ROUTE.SEARCH_ENGINE,
      docTab: DASHBOARD_DOC_ROUTE.TABLE,
      layoutTab: DASHBOARD_LAYOUT_ROUTE.GENERAL,
      broadcastTab: DASHBOARD_BROADCAST_ROUTE.GLOBAL,
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
