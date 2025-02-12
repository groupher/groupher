import { proxy } from 'valtio'
import { mergeDeepRight, mergeLeft } from 'ramda'

import { LOCALE } from '~/const/i18n'
import { THREAD } from '~/const/thread'
import SIZE from '~/const/size'
import { COLOR_NAME, PAGE_COLOR_DEFAULT } from '~/const/colors'
import { BUILDIN_ALIAS } from '~/const/name'
import { GLOW_OPACITY } from '~/const/glow_effect'
import { CHANGE_MODE } from '~/const/mode'
import { EMPTY_PAGED_COMMUNITIES, EMPTY_PAGED_ARTICLES } from '~/const/utils'
import { TW_CARD, WIDGET_TYPE, INIT_KANBAN_COLORS, DEFAULT_ENABLE } from '~/const/dashboard'
import {
  HEADER_LAYOUT,
  FOOTER_LAYOUT,
  POST_LAYOUT,
  CHANGELOG_LAYOUT,
  KANBAN_LAYOUT,
  KANBAN_CARD_LAYOUT,
  DOC_LAYOUT,
  DOC_FAQ_LAYOUT,
  TAG_LAYOUT,
  AVATAR_LAYOUT,
  BRAND_LAYOUT,
  BANNER_LAYOUT,
  TOPBAR_LAYOUT,
  BROADCAST_LAYOUT,
  BROADCAST_ARTICLE_LAYOUT,
  RSS_TYPE,
} from '~/const/layout'
import {
  DASHBOARD_ROUTE,
  DASHBOARD_LAYOUT_ROUTE,
  DASHBOARD_BASEINFO_ROUTE,
  DASHBOARD_ALIAS_ROUTE,
  DASHBOARD_BROADCAST_ROUTE,
  DASHBOARD_SEO_ROUTE,
  DASHBOARD_DOC_ROUTE,
} from '~/const/route'

import type { TStore, TInitState, TSettingsFields } from './spec'
import { EMPTY_MEDIA_REPORT, DEFAULT_FAQ_ITEMS, DEFAULT_OVERVIEW } from './constant'

export const settingsFields: TSettingsFields = {
  // baseInfo
  favicon: '',
  logo: '',
  locale: LOCALE.EN,
  title: '',
  slug: '',
  desc: '',
  introduction: '',
  homepage: '',
  city: '',
  techstack: '',

  // social
  socialLinks: [],
  mediaReports: [EMPTY_MEDIA_REPORT],

  // page
  pageBg: PAGE_COLOR_DEFAULT.light,
  pageBgDark: PAGE_COLOR_DEFAULT.dark,

  // seo
  seoEnable: true,
  ogSiteName: '',
  ogTitle: '',
  ogDescription: '',
  ogUrl: '',
  ogImage: '',
  ogLocale: '',
  ogPublisher: '',

  twTitle: '',
  twDescription: '',
  twUrl: '',
  twCard: TW_CARD.SUMMARY,
  twSite: '',
  twImage: '',
  twImageWidth: '',
  twImageHeight: '',

  // layout
  primaryColor: COLOR_NAME.BLACK,
  postLayout: POST_LAYOUT.QUORA,
  kanbanLayout: KANBAN_LAYOUT.CLASSIC,
  kanbanCardLayout: KANBAN_CARD_LAYOUT.SIMPLE,
  kanbanBgColors: INIT_KANBAN_COLORS,

  docLayout: DOC_LAYOUT.CARDS,
  docFaqLayout: DOC_FAQ_LAYOUT.COLLAPSE,
  tagLayout: TAG_LAYOUT.HASH,
  avatarLayout: AVATAR_LAYOUT.SQUARE,
  brandLayout: BRAND_LAYOUT.BOTH,
  bannerLayout: BANNER_LAYOUT.HEADER,
  topbarLayout: TOPBAR_LAYOUT.NO,
  topbarBg: COLOR_NAME.ORANGE,

  broadcastLayout: BROADCAST_LAYOUT.DEFAULT,
  broadcastBg: COLOR_NAME.BLACK,
  broadcastEnable: false,

  broadcastArticleLayout: BROADCAST_ARTICLE_LAYOUT.DEFAULT,
  broadcastArticleBg: COLOR_NAME.RED,
  broadcastArticleEnable: true,

  changelogLayout: CHANGELOG_LAYOUT.CLASSIC,

  // doc
  docCategories: [],

  // glow effect
  glowType: '',
  glowFixed: true,
  glowOpacity: GLOW_OPACITY.NORMAL,

  // goss blur
  gossBlur: 100,
  gossBlurDark: 100,

  // contents
  // tags
  tags: [],
  activeTagGroup: null,
  activeTagThread: THREAD.POST,
  nameAlias: BUILDIN_ALIAS,
  enable: DEFAULT_ENABLE,

  faqSections: DEFAULT_FAQ_ITEMS,
  rssFeedType: RSS_TYPE.DIGEST,
  rssFeedCount: 5,

  headerLayout: HEADER_LAYOUT.CENTER,
  footerLayout: FOOTER_LAYOUT.GROUP,

  footerLinks: [],
  headerLinks: [],

  // moderators
  moderators: [],

  // widgets
  widgetsPrimaryColor: COLOR_NAME.BLACK,
  widgetsThreads: [THREAD.POST],
  widgetsSize: SIZE.MEDIUM,
  widgetsType: WIDGET_TYPE.SIDEBAR,
}

export default (initState: TInitState = {}): TStore => {
  const store = proxy(
    mergeLeft(initState, {
      ...settingsFields,
      initFilled: false,
      // for edit/rollback in dashboard
      original: settingsFields,

      savingField: null,
      saving: false,
      loading: false,
      curTab: DASHBOARD_ROUTE.INFO,
      baseInfoTab: DASHBOARD_BASEINFO_ROUTE.BASIC,

      aliasTab: DASHBOARD_ALIAS_ROUTE.THREAD,
      seoTab: DASHBOARD_SEO_ROUTE.SEARCH_ENGINE,
      docTab: DASHBOARD_DOC_ROUTE.TABLE,
      layoutTab: DASHBOARD_LAYOUT_ROUTE.GENERAL,
      broadcastTab: DASHBOARD_BROADCAST_ROUTE.GLOBAL,

      // overview
      overview: DEFAULT_OVERVIEW,

      // editing
      editingTag: null,
      settingTag: null,
      editingAlias: null,
      editingLink: null,
      editingLinkMode: CHANGE_MODE.CREATE,

      editingGroup: null,
      editingGroupIndex: null,
      editingFAQIndex: null,
      editingFAQ: null,

      queringMediaReportIndex: null,

      // cms
      batchSelectedIDs: [],
      pagedCommunities: EMPTY_PAGED_COMMUNITIES,
      pagedPosts: EMPTY_PAGED_ARTICLES,
      pagedDocs: EMPTY_PAGED_ARTICLES,
      pagedChangelogs: EMPTY_PAGED_ARTICLES,

      // for global alert
      demoAlertEnable: false,

      activeModerator: null,
      allModeratorRules: '{}',
      allRootRules: '{}',

      commit: (patch: Partial<TStore>): void => {
        Object.assign(store, mergeDeepRight(store, patch))
      },
      debug: () => {
        store.editingLink = null
        store.headerLinks = []
      },
    }),
  )

  return store
}
