import { COLOR_NAME, PAGE_BG_DEFAULT } from '~/const/colors'
import { DEFAULT_ENABLE, TW_CARD, WIDGET_TYPE } from '~/const/dashboard'
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
import { BUILTIN_ALIAS } from '~/const/name'
import SIZE from '~/const/size'
import THEME from '~/const/theme'
import { THREAD } from '~/const/thread'
import { EMPTY_MEDIA_REPORT } from '~/containers/thread/DashboardThread/constant'
import type { TSnakeUpperCase } from '~/spec'
import type { TDsbField, TDsbFields } from './spec'

export { SEO_KEYS, SEO_OG_KEYS, SEO_TW_KEYS } from '~/const/seo'

export const ALIGN_HEADER_OFFSET = '100px'

// for local store, demo setting usage
export const DSB_DEMO_KEY = 'dashboard_demo'

// do not change, it's map to GQ endpoint updateDashboardLayout
export const LAYOUT_FIELD = {
  PRIMARY_COLOR: 'primaryColor',
  POST_LAYOUT: 'postLayout',
  KANBAN_LAYOUT: 'kanbanLayout',
  KANBAN_CARD_LAYOUT: 'kanbanCardLayout',
  KANBAN_BG_COLORS: 'kanbanBgColors',
  DOC_LAYOUT: 'docLayout',
  DOC_FAQ_LAYOUT: 'docFaqLayout',
  BRAND_LAYOUT: 'brandLayout',
  TAG_LAYOUT: 'tagLayout',
  AVATAR_LAYOUT: 'avatarLayout',
  BANNER_LAYOUT: 'bannerLayout',
  HEADER_LAYOUT: 'headerLayout',
  FOOTER_LAYOUT: 'footerLayout',
  TOPBAR_LAYOUT: 'topbarLayout',
  TOPBAR_BG: 'topbarBg',
  BROADCAST_LAYOUT: 'broadcastLayout',
  BROADCAST_ARTICLE_LAYOUT: 'broadcastArticleLayout',
  BROADCAST_BG: 'broadcastBg',
  BROADCAST_ARTICLE_BG: 'broadcastArticleBg',
  CHANGELOG_LAYOUT: 'changelogLayout',
  GLOW_TYPE: 'glowType',
  GLOW_FIXED: 'glowFixed',
  GLOW_OPACITY: 'glowOpacity',
  GAUSS_BLUR: 'gaussBlur',
  GAUSS_BLUR_DARK: 'gaussBlurDark',
}

export const FIELD = {
  ...LAYOUT_FIELD,
  BASE_INFO: 'baseInfo',
  MEDIA_REPORTS: 'mediaReports',
  SEO: 'seo',
  SOCIAL_LINKS: 'socialLinks',
  HEADER_LINKS: 'headerLinks',
  FOOTER_LINKS: 'footerLinks',
  TAG: 'tag',
  TAG_INDEX: 'tagIndex',
  FAQ_SECTIONS: 'faqSections',
  FAQ_SECTION_ITEM: 'faqSectionItem',
  FAQ_SECTION_ADD: 'faqSectionAdd',
  FAQ_SECTION_DELETE: 'faqSectionDelete',
  NAME_ALIAS: 'nameAlias',
  RSS_FEED_TYPE: 'rssFeedType',
  RSS_FEED_COUNT: 'rssFeedCount',
  WIDGETS_PRIMARY_COLOR: 'widgetsPrimaryColor',
  WIDGETS_SIZE: 'widgetsSize',
  WIDGETS_THREADS: 'widgetsThreads',
  GLOW_TYPE: 'glowType',
  GLOW_FIXED: 'glowFixed',
  GLOW_OPACITY: 'glowOpacity',
  BROADCAST_ENABLE: 'broadcastEnable',
  ENABLE: 'enable',
} as Record<TSnakeUpperCase<TDsbField>, TDsbField>

export const DEFAULT_OVERVIEW = {
  views: 0,
  subscribersCount: 0,
  postsCount: 0,
  changelogsCount: 0,
  docsCount: 0,
}

export const BASEINFO_BASIC_KEYS = [
  'favicon',
  'locale',
  'logo',
  'title',
  'desc',
  'introduction',
  'homepage',
  'slug',
] as const

export const BASEINFO_OTHER_KEYS = ['city', 'techstack'] as const

export const BASEINFO_KEYS = [
  ...BASEINFO_BASIC_KEYS,
  ...BASEINFO_OTHER_KEYS,
] as const satisfies readonly TDsbField[]

export const HEADER_SETTING_KEYS = [
  'saving',
  'headerLayout',
  'headerLinks',
  'editingLink',
  'editingLinkMode',
  'editingGroup',
  'editingGroupIndex',
]

export const FOOTER_SETTING_KEYS = [
  'saving',
  'footerLayout',
  'footerLinks',
  'editingLink',
  'editingLinkMode',
  'editingGroup',
  'editingGroupIndex',
]

export const DEFAULT_NEW_FAQ = {
  title: '',
  body: '',
  index: 0,
}

export const INIT_KANBAN_COLORS = [COLOR_NAME.BLACK, COLOR_NAME.BLACK, COLOR_NAME.BLACK]

export const FIELDS: TDsbFields = {
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
  pageBg: PAGE_BG_DEFAULT[THEME.LIGHT],
  pageBgDark: PAGE_BG_DEFAULT[THEME.DARK],

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

  // gauss blur
  gaussBlur: 100,
  gaussBlurDark: 100,

  // contents
  // tags
  tags: [],
  activeTagGroup: null,
  activeTagThread: THREAD.POST,
  nameAlias: BUILTIN_ALIAS,
  enable: DEFAULT_ENABLE,

  faqSections: [],
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
