import type {
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
import type { DSB_TAB } from '~/const/route'
import type { KANBAN_BOARD } from '~/const/thread'
import type { TConstValues } from '~/spec'
import type { TDsbFieldKey, TDsbFieldMap } from '~/stores/dashboard/spec'

import type { TFAQSection } from './article'
import type { TColorName } from './color'
import type { TModerator } from './community'
import type { TEditValue, THeaderLinkItem, TLinkItem, TSocialItem } from './utils'
import type { TWallpaperData } from './wallpaper'

export type TTagLayout = TConstValues<typeof TAG_LAYOUT>
export type TInlineTagLayout = TConstValues<typeof INLINE_TAG_LAYOUT>
export type TAvatarLayout = TConstValues<typeof AVATAR_LAYOUT>
export type TBrandLayout = TConstValues<typeof BRAND_LAYOUT>
export type TCommunityLayout = TConstValues<typeof COMMUNITY_LAYOUT>
export type TNavActiveLayout = TConstValues<typeof NAV_ACTIVE_LAYOUT>

export type TPostLayout = TConstValues<typeof POST_LAYOUT>
export type TKanbanLayout = TConstValues<typeof KANBAN_LAYOUT>
export type TKanbanCardLayout = TConstValues<typeof KANBAN_CARD_LAYOUT>
export type TKanbanBoard = TConstValues<typeof KANBAN_BOARD>
export type TChangelogLayout = TConstValues<typeof CHANGELOG_LAYOUT>
export type TDocCoverLayout = TConstValues<typeof DOC_COVER_LAYOUT>
export type TDocFAQLayout = TConstValues<typeof DOC_FAQ_LAYOUT>
export type THeaderLayout = TConstValues<typeof HEADER_LAYOUT>
export type TFooterLayout = TConstValues<typeof FOOTER_LAYOUT>
export type TRSSType = TConstValues<typeof RSS_TYPE>
export type TBroadcastLayout = TConstValues<typeof BROADCAST_LAYOUT>
export type TBroadcastArticleLayout = TConstValues<typeof BROADCAST_ARTICLE_LAYOUT>

export type TDsbTab = (typeof DSB_TAB)[keyof typeof DSB_TAB]

export type TMediaReport = {
  index: number
  favicon: string
  siteName: string
  title: string
  url: string
  editUrl?: string
}

export type TDsb = {
  enable?: TEnableConf
  nameAlias?: readonly TNameAlias[]
  socialLinks?: readonly TSocialItem[]
  faqs?: readonly TFAQSection[]
  seo?: TDsdSEOConf

  layout?: {
    brandLayout: TBrandLayout
    pageBg: string
    pageBgDark: string
    pageCustomBg: number
    pageCustomBgDark: number
    pageCustomIntensity: number
    pageCustomIntensityDark: number
    primaryColor: TColorName
    primaryCustomColor: string
    primaryCustomColorDark: string
    subPrimaryColor: TColorName
    subPrimaryCustomColor: string
    subPrimaryCustomColorDark: string
    topbarEnabled: boolean
    topbarBg: TColorName
    topbarBgCustomColor: string
    tagLayout: TTagLayout
    inlineTagLayout: TInlineTagLayout
    avatarLayout: TAvatarLayout
    communityLayout: TCommunityLayout
    navActiveLayout: TNavActiveLayout
    glowType: string
    glowFixed: boolean
    glowOpacity: string
    overlayDark: boolean
    docCoverLayout: TDocCoverLayout
    docFaqLayout: TDocFAQLayout
    postLayout: TPostLayout
    kanbanLayout: TKanbanLayout
    kanbanCardLayout: TKanbanCardLayout
    kanbanBoards: readonly TKanbanBoard[]
    kanbanBgColors: readonly TColorName[]
    changelogLayout: TChangelogLayout
    headerLayout: THeaderLayout
    footerLayout: TFooterLayout
  }

  moderators?: readonly TModerator[]

  rss?: {
    rssFeedType: TRSSType
    rssFeedCount: number
  }

  headerLinks?: readonly THeaderLinkItem[]
  footerLinks?: readonly TLinkItem[]

  wallpaper?: TWallpaperData
  baseInfo?: {
    title?: string
    bio?: string
    homepage?: string
  }
  mediaReports?: readonly TMediaReport[]
}

export type TParseDashboard = TDsbFieldMap & {
  original: TDsbFieldMap
}

export type TBroadcastConf = {
  // banner
  broadcastLayout: TBroadcastLayout
  broadcastBg: TColorName
  broadcastCustomBg: string
  broadcastEnable: boolean
  // article
  broadcastArticleBg: TColorName
  broadcastArticleCustomBg: string
  broadcastArticleLayout: TBroadcastArticleLayout
  broadcastArticleEnable: boolean
}

export type TEnableConf = {
  post: boolean
  kanban: boolean
  changelog: boolean
  //
  doc: boolean
  docLastUpdate: boolean
  docReaction: boolean
  //
  about: boolean
  aboutTechstack: boolean
  aboutLocation: boolean
  aboutLinks: boolean
  aboutMediaReport: boolean
}

export type TNameAlias = {
  slug: string
  name: string
  original?: string
  group?: string
}

export type TDsdThreadConf = {
  enable: TEnableConf
  nameAlias: TNameAlias[]
}

export type TDsdSEOConf = {
  seoEnable: boolean
  ogSiteName: string
  ogTitle: string
  ogDescription?: string
  ogUrl: string
  ogImage?: string
  ogLocale?: string
  ogPublisher?: string

  twTitle: string
  twDescription: string
  twUrl: string
  twCard: string // 'summary' | 'summary_large_image'
  twSite: string
  twImage: string
  twImageWidth: string
  twImageHeight: string
}

export type TOverview = {
  views: number
  subscribersCount: number
  postsCount: number
  changelogsCount: number
  docsCount: number
}

export type TEditFunc = (value: TEditValue, field: TDsbFieldKey) => void
