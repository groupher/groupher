import { BUILTIN_ALIAS } from '~/const/builtin-alias'
import { COLOR } from '~/const/colors'
import { DEFAULT_ENABLE, INIT_KANBAN_BOARDS, TW_CARD } from '~/const/dashboard'
import { GLOW_OPACITY } from '~/const/glow_effect'
import { LOCALE } from '~/const/i18n'
import {
  AVATAR_LAYOUT,
  BRAND_LAYOUT,
  BROADCAST_ARTICLE_LAYOUT,
  BROADCAST_LAYOUT,
  CHANGELOG_LAYOUT,
  COMMUNITY_LAYOUT,
  DOC_COVER_LAYOUT,
  DOC_FAQ_LAYOUT,
  FOOTER_LAYOUT,
  HEADER_LAYOUT,
  INLINE_TAG_LAYOUT,
  KANBAN_CARD_LAYOUT,
  KANBAN_LAYOUT,
  NAV_ACTIVE_LAYOUT,
  POST_LAYOUT,
  RSS_TYPE,
  TAG_LAYOUT,
} from '~/const/layout'
import SIZE from '~/const/size'
import {
  DEFAULT_TEXT_DIGEST,
  DEFAULT_TEXT_TITLE,
  DEFAULT_THEME_PRESET,
  THEME_PRESET_OPTIONS,
} from '~/const/theme_preset'
import { THREAD } from '~/const/thread'

import type { TDsbFieldMap } from './spec'

export const DEFAULT_OVERVIEW = {
  views: 0,
  subscribersCount: 0,
  postsCount: 0,
  changelogsCount: 0,
  docsCount: 0,
}

const EMPTY_MEDIA_REPORT = {
  index: 0,
  title: '',
  favicon: '',
  siteName: '',
  url: '',
  editUrl: '',
}

const INIT_KANBAN_COLORS = [COLOR.BLACK, COLOR.YELLOW, COLOR.PURPLE, COLOR.GREEN, COLOR.RED]
const DEFAULT_THEME_OVERRIDES =
  THEME_PRESET_OPTIONS.find((preset) => preset.value === DEFAULT_THEME_PRESET)?.overrides ??
  THEME_PRESET_OPTIONS[0].overrides

export const FIELDS: TDsbFieldMap = {
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
  themePreset: DEFAULT_THEME_PRESET,
  themeOverrides: { ...DEFAULT_THEME_OVERRIDES },
  pageBg: DEFAULT_THEME_OVERRIDES.pageBg,
  pageBgDark: DEFAULT_THEME_OVERRIDES.pageBgDark,
  pageCustomBg: DEFAULT_THEME_OVERRIDES.pageCustomBg,
  pageCustomBgDark: DEFAULT_THEME_OVERRIDES.pageCustomBgDark,
  pageCustomIntensity: DEFAULT_THEME_OVERRIDES.pageCustomIntensity,
  pageCustomIntensityDark: DEFAULT_THEME_OVERRIDES.pageCustomIntensityDark,

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
  primaryColor: DEFAULT_THEME_OVERRIDES.primaryColor,
  primaryCustomColor: DEFAULT_THEME_OVERRIDES.primaryCustomColor,
  primaryCustomColorDark: DEFAULT_THEME_OVERRIDES.primaryCustomColorDark,
  subPrimaryColor: DEFAULT_THEME_OVERRIDES.subPrimaryColor,
  subPrimaryCustomColor: '',
  subPrimaryCustomColorDark: '',
  textTitle: DEFAULT_THEME_OVERRIDES.textTitle || DEFAULT_TEXT_TITLE,
  textDigest: DEFAULT_THEME_OVERRIDES.textDigest || DEFAULT_TEXT_DIGEST,
  postLayout: POST_LAYOUT.QUORA,
  kanbanLayout: KANBAN_LAYOUT.CLASSIC,
  kanbanCardLayout: KANBAN_CARD_LAYOUT.SIMPLE,
  kanbanBoards: INIT_KANBAN_BOARDS,
  kanbanBgColors: INIT_KANBAN_COLORS,

  docCoverLayout: DOC_COVER_LAYOUT.STACK_CARDS,
  docFaqLayout: DOC_FAQ_LAYOUT.COLLAPSE,
  tagLayout: TAG_LAYOUT.HASH,
  inlineTagLayout: INLINE_TAG_LAYOUT.BORDER,
  avatarLayout: AVATAR_LAYOUT.SQUARE,
  brandLayout: BRAND_LAYOUT.BOTH,
  communityLayout: COMMUNITY_LAYOUT.CLASSIC,
  navActiveLayout: NAV_ACTIVE_LAYOUT.TEXT,
  topbarEnabled: false,
  topbarBg: COLOR.ORANGE,
  topbarBgCustomColor: '',

  broadcastLayout: BROADCAST_LAYOUT.DEFAULT,
  broadcastBg: COLOR.BLACK,
  broadcastCustomBg: '',
  broadcastEnable: false,

  broadcastArticleLayout: BROADCAST_ARTICLE_LAYOUT.DEFAULT,
  broadcastArticleBg: COLOR.RED,
  broadcastArticleCustomBg: '',
  broadcastArticleEnable: true,

  changelogLayout: CHANGELOG_LAYOUT.CLASSIC,

  // doc
  docCategories: [],

  // glow effect
  glowType: '',
  glowFixed: true,
  glowOpacity: GLOW_OPACITY.NORMAL,

  overlayDark: true,

  // gauss blur
  gaussBlur: 100,
  gaussBlurDark: 100,

  // contents
  // tags
  tagGroups: [],
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
  footerOnelineLinks: [],
  headerLinks: [],

  // moderators
  moderators: [],

  // widgets
  widgetsPrimaryColor: COLOR.BLACK,
  widgetsThreads: [THREAD.POST],
  widgetsSize: SIZE.MEDIUM,
}
