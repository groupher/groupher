import { proxy } from 'valtio'
import { CHANGE_MODE } from '~/const/mode'
import {
  DSB_ALIAS_ROUTE,
  DSB_BASEINFO_ROUTE,
  DSB_BROADCAST_ROUTE,
  DSB_DOC_ROUTE,
  DSB_LAYOUT_ROUTE,
  DSB_ROUTE,
  DSB_SEO_ROUTE,
} from '~/const/route'
import { EMPTY_PAGED_ARTICLES, EMPTY_PAGED_COMMUNITIES } from '~/const/utils'
import { DEFAULT_OVERVIEW, SETTING_FIELDS } from './constant'
import type { TInit, TStore } from './spec'

export default (init: TInit = {}): TStore => {
  const states = Object.assign(
    {
      ...SETTING_FIELDS,
      curTab: DSB_ROUTE.INFO,
      initFilled: false,
      original: SETTING_FIELDS,
      savingField: null,
      saving: false,
      loading: false,
      baseInfoTab: DSB_BASEINFO_ROUTE.BASIC,
      aliasTab: DSB_ALIAS_ROUTE.THREAD,
      seoTab: DSB_SEO_ROUTE.SEARCH_ENGINE,
      docTab: DSB_DOC_ROUTE.TABLE,
      layoutTab: DSB_LAYOUT_ROUTE.GENERAL,
      broadcastTab: DSB_BROADCAST_ROUTE.GLOBAL,
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
