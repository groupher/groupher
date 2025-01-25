import type { TColorName } from './color'
import type { TWallpaperData } from './wallpaper'
import type { TLinkItem, TSocialItem, TEditValue } from './utils'
import type { TFAQSection } from './article'
import type { TUser } from './account'

import type { TSettingField } from '~/stores/dashboard/spec'

export type TTagLayout = 'hash' | 'dot'
export type TAvatarLayout = 'circle' | 'square'
export type TBrandLayout = 'both' | 'logo' | 'text'
export type TBannerLayout = 'header' | 'tabber' | 'sidebar'

export type TTopbarLayout = 'yes' | 'no'
export type TPostLayout = 'quora' | 'ph' | 'masonry' | 'minimal' | 'cover'
export type TKanbanLayout = 'classic' | 'waterfall'
export type TKanbanCardLayout = 'simple' | 'full'
export type TChangelogLayout = 'classic' | 'simple'
export type TDocLayout = 'blocks' | 'lists' | 'cards' | 'article'
export type TDocFAQLayout = 'flat' | 'collapse' | 'search_hint'
export type THeaderLayout = 'center' | 'right' | 'float'
export type TFooterLayout = 'simple' | 'group'
export type TRSSType = 'digest' | 'full'

export type TBroadcastLayout = 'default' | 'center'
export type TBroadcastArticleLayout = 'default' | 'simple'

export type TMediaReport = {
  index: number
  favicon: string
  siteName: string
  title: string
  url: string
  editUrl?: string
}

export type TDashboard = {
  enable?: TEnableConfig
  nameAlias?: TNameAlias[]

  socialLinks?: TSocialItem[]
  faqs?: TFAQSection[]
  seo?: TDashboardSEOConfig

  layout?: {
    brandLayout: TBrandLayout
    topbarLayout: TTopbarLayout
    topbarBg: TColorName
    tagLayout: TTagLayout
    avatarLayout: TAvatarLayout
    bannerLayout: TBannerLayout
    glowType: string
    glowFixed: boolean
    glowOpacity: string
    docLayout: TDocLayout
    docFaqLayout: TDocFaqLayout
    postLayout: TPostLayout
    kanbanCardLayout: TKanbanCardLayout
    kanbanBgColors: TColorName[]
    changelogLayout: TChangelogLayout
    headerLayout: THeaderLayout
    footerLayout: TFooterLayout
  }

  moderators?: TUser[]

  rss?: {
    rssFeedType: TRSSType
    rssFeedCount: number
  }

  headerLinks?: TLinkItem[]
  footerLinks?: TLinkItem[]

  wallpaper?: TWallpaperData
  baseInfo?: {
    title?: string
    bio?: string
    homepage?: string
  }
  mediaReports?: TMediaReport[]

  pageBg?: string
  pageBgDark?: string
}

export type TBroadcastConfig = {
  // banner
  broadcastLayout: TBroadcastLayout
  broadcastBg: TColorName
  broadcastEnable: boolean
  // article
  broadcastArticleBg: TColorName
  broadcastArticleLayout: TBroadcastArticleLayout
  broadcastArticleEnable: boolean
}

export type TEnableConfig = {
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

export type TDashboardThreadConfig = {
  enable: TEnableConfig
  nameAlias: TNameAlias[]
}

export type TDashboardSEOConfig = {
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

export type TEditFunc = (value: TEditValue, field: TSettingField) => void
