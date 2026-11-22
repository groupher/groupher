import type { DSB_TAB } from '~/const/route'
import type {
  DsbAvatarLayout,
  DsbBrandLayout,
  DsbBroadcastArticleLayout,
  DsbBroadcastLayout,
  DsbChangelogLayout,
  DsbCommunityLayout,
  DsbDocCoverLayout,
  DsbDocFaqLayout,
  DsbFooterLayout,
  DsbHeaderLayout,
  DsbInlineTagLayout,
  DsbKanbanCardLayout,
  DsbKanbanLayout,
  DsbNavActiveLayout,
  DsbPostLayout,
  DsbTagLayout,
  KanbanBoard,
} from '~/lib/graphql/generated/enums'
import type { TThirdPartyAnalyticsConfig } from '~/lib/thirdPartyAnalytics'
import type { TConstValues } from '~/spec'

import type { TColorName } from './color'
import type { TAdmin } from './community'
import type { TDsbFieldKey, TDsbFieldMap } from './dsb'
import type { TPaginationMode } from './pagination'
import type {
  TResolvedThemePreset,
  TThemePreset,
  TThemePresetOption,
  TThemePresetOverwrite,
} from './theme_preset'
import type { TEditValue, TFooterOnelineLink, TLinkItem, TSocialItem } from './utils'
import type {
  TPublishedWallpaper,
  TWallpaperConfig,
  TWallpaperSettingsTransportByTheme,
} from './wallpaper'

export type TTagLayout = DsbTagLayout
export type TInlineTagLayout = DsbInlineTagLayout
export type TAvatarLayout = DsbAvatarLayout
export type TBrandLayout = DsbBrandLayout
export type TCommunityLayout = DsbCommunityLayout
export type TNavActiveLayout = DsbNavActiveLayout

export type TPostLayout = DsbPostLayout
export type TKanbanLayout = DsbKanbanLayout
export type TKanbanCardLayout = DsbKanbanCardLayout
export type TKanbanBoard = KanbanBoard
export type TChangelogLayout = DsbChangelogLayout
export type TDocCoverLayout = DsbDocCoverLayout
export type TDocFAQLayout = DsbDocFaqLayout
export type THeaderLayout = DsbHeaderLayout
export type TFooterLayout = DsbFooterLayout
export type TFooterLinks = {
  layout: TFooterLayout
  links: readonly TLinkItem[]
  onelineLinks: readonly TFooterOnelineLink[]
}
export type TBroadcastLayout = DsbBroadcastLayout
export type TBroadcastArticleLayout = DsbBroadcastArticleLayout

export type TDsbTab = (typeof DSB_TAB)[keyof typeof DSB_TAB]

export type TMediaReport = {
  index: number
  favicon: string
  siteName: string
  title: string
  url: string
  editUrl?: string
}

export type TDocFaqItem = {
  id: string
  title: string
  detail: string
  index: number
}

export type TDocFaqGroup = {
  id: string
  title: string
  index: number
  items: readonly TDocFaqItem[]
}

export type TDocFaq = {
  title: string
  desc: string
  groupedView: boolean
  groupItems: readonly TDocFaqGroup[]
  flatItems: readonly TDocFaqItem[]
}

export type TDsbRaw = {
  pagiMode?: TPaginationMode
  pagiMobileMode?: TPaginationMode
  pagiRevision?: number
  enable?: TEnableConf
  nameAlias?: readonly TNameAlias[]
  socialLinks?: readonly TSocialItem[]
  docFaq?: TDocFaq
  seo?: TDsdSEOConf

  layout?: {
    brandLayout: TBrandLayout
    themePreset?: TThemePreset | null
    themePresetBase?: TThemePreset | null
    themeTokens?: TResolvedThemePreset | null
    themePresets?: readonly TThemePresetOption[] | null
    themeOverwrite?: TThemePresetOverwrite | null
    topbarEnabled: boolean
    topbarBg: TColorName
    topbarBgCustomColor: string
    tagLayout: TTagLayout
    inlineTagLayout: TInlineTagLayout
    avatarLayout: TAvatarLayout
    communityLayout: TCommunityLayout
    navActiveLayout: TNavActiveLayout
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
  } | null

  headerLinks?: readonly TLinkItem[]
  footerLinks?: readonly TLinkItem[]
  footerOnelineLinks?: readonly TFooterOnelineLink[]

  wallpaper?: TPublishedWallpaper
  contentShadow?: boolean
  wallpaperSettings?: TWallpaperSettingsTransportByTheme
  baseInfo?: {
    title?: string
    bio?: string
    homepage?: string
  }
  mediaReports?: readonly TMediaReport[]
  thirdPartyAnalytics?: readonly TThirdPartyAnalyticsConfig[]
  enabledThirdPartyAnalytics?: readonly TThirdPartyAnalyticsConfig[]
  umamiWebsiteId?: string | null
}

export type TDsb = TDsbFieldMap & {
  pagiRevision?: number
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
  visitorLocationMap: boolean
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
