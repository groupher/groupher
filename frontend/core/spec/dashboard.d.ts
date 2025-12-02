import type { TDsbField } from '~/stores/dashboard/spec'
import type { TFAQSection } from './article'
import type { TColorName } from './color'
import type { TModerator } from './community'
import type { TEditValue, TLinkItem, TSocialItem } from './utils'
import type { TWallpaperData } from './wallpaper'

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
export type TDocFAQLayout = 'flat' | 'collapse' | 'search_hint' | 'left_right'
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

export type TDsb = {
  enable?: TEnableConf
  nameAlias?: TNameAlias[]

  socialLinks?: TSocialItem[]
  faqs?: TFAQSection[]
  seo?: TDsdSEOConf

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

  moderators?: TModerator[]

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

export type TParseDashboard = TDsb & {
  original: TDsb
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

export type TEditFunc = (value: TEditValue, field: TDsbField) => void
