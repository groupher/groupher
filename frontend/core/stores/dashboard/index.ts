import { proxy } from 'valtio'
import { COLOR_NAME, CONTAINER_BG_DEFAULT } from '~/const/colors'
import { DEFAULT_ENABLE, INIT_KANBAN_COLORS, TW_CARD, WIDGET_TYPE } from '~/const/dashboard'
import { GLOW_OPACITY } from '~/const/glow_effect'
import { LOCALE } from '~/const/i18n'
import {
  AVATAR_LAYOUT,
  BANNER_LAYOUT,
  BRAND_LAYOUT,
  BROADCAST_ARTICLE_LAYOUT,
  BROADCAST_LAYOUT,
  CHANGELOG_LAYOUT,
  DOC_FAQ_LAYOUT,
  DOC_LAYOUT,
  FOOTER_LAYOUT,
  HEADER_LAYOUT,
  KANBAN_CARD_LAYOUT,
  KANBAN_LAYOUT,
  POST_LAYOUT,
  RSS_TYPE,
  TAG_LAYOUT,
  TOPBAR_LAYOUT,
} from '~/const/layout'
import { CHANGE_MODE } from '~/const/mode'
import { BUILTIN_ALIAS } from '~/const/name'
import {
  DASHBOARD_ALIAS_ROUTE,
  DASHBOARD_BASEINFO_ROUTE,
  DASHBOARD_BROADCAST_ROUTE,
  DASHBOARD_DOC_ROUTE,
  DASHBOARD_LAYOUT_ROUTE,
  DASHBOARD_ROUTE,
  DASHBOARD_SEO_ROUTE,
} from '~/const/route'
import SIZE from '~/const/size'
import { THREAD } from '~/const/thread'
import { EMPTY_PAGED_ARTICLES, EMPTY_PAGED_COMMUNITIES } from '~/const/utils'
import { DEFAULT_FAQ_ITEMS, DEFAULT_OVERVIEW, EMPTY_MEDIA_REPORT } from './constant'
import type { TInit, TSettingsFields, TStore } from './spec'

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
  pageBg: CONTAINER_BG_DEFAULT.light,
  pageBgDark: CONTAINER_BG_DEFAULT.dark,

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
  nameAlias: BUILTIN_ALIAS,
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

export default (init: TInit = {}): TStore => {
  const states = Object.assign(
    {
      ...settingsFields,
      curTab: DASHBOARD_ROUTE.INFO,
      initFilled: false,
      original: settingsFields,
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
      queringMediaReportIndex: null,
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
