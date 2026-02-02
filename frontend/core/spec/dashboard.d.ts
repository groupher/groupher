import type {
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
import type { DSB_TAB } from '~/const/route'
import type { TConstValues } from '~/spec'
import type { TDsbFieldKey, TDsbFieldMap } from '~/stores/dashboard/spec'
import type { TFAQSection } from './article'
import type { TColorName } from './color'
import type { TModerator } from './community'
import type { TEditValue, TLinkItem, TSocialItem } from './utils'
import type { TWallpaperData } from './wallpaper'

export type TTagLayout = TConstValues<typeof TAG_LAYOUT>
export type TAvatarLayout = TConstValues<typeof AVATAR_LAYOUT>
export type TBrandLayout = TConstValues<typeof BRAND_LAYOUT>
export type TBannerLayout = TConstValues<typeof BANNER_LAYOUT>

export type TTopbarLayout = TConstValues<typeof TOPBAR_LAYOUT>
export type TPostLayout = TConstValues<typeof POST_LAYOUT>
export type TKanbanLayout = TConstValues<typeof KANBAN_LAYOUT>
export type TKanbanCardLayout = TConstValues<typeof KANBAN_CARD_LAYOUT>
export type TChangelogLayout = TConstValues<typeof CHANGELOG_LAYOUT>
export type TDocLayout = TConstValues<typeof DOC_LAYOUT>
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
    primaryColor: TColorName
    topbarLayout: TTopbarLayout
    topbarBg: TColorName
    tagLayout: TTagLayout
    avatarLayout: TAvatarLayout
    bannerLayout: TBannerLayout
    glowType: string
    glowFixed: boolean
    glowOpacity: string
    darkFloat: boolean
    docLayout: TDocLayout
    docFaqLayout: TDocFaqLayout
    postLayout: TPostLayout
    kanbanCardLayout: TKanbanCardLayout
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

  headerLinks?: readonly TLinkItem[]
  footerLinks?: readonly TLinkItem[]

  wallpaper?: TWallpaperData
  baseInfo?: {
    title?: string
    bio?: string
    homepage?: string
  }
  mediaReports?: readonly TMediaReport[]

  pageBg?: string
  pageBgDark?: string
}

export type TParseDashboard = TDsbFieldMap & {
  original: TDsbFieldMap
}

export type TBroadcastConf = {
  // banner
  broadcastLayout: TBroadcastLayout
  broadcastBg: TColorName
  broadcastEnable: boolean
  // article
  broadcastArticleBg: TColorName
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
