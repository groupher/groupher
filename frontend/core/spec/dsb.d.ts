import type {
  TAvatarLayout,
  TBrandLayout,
  TBroadcastArticleLayout,
  TBroadcastLayout,
  TChangelogLayout,
  TColorName,
  TCommunityLayout,
  TDocFAQLayout,
  TDocCoverLayout,
  TDocFaq,
  TEnableConf,
  TFooterLayout,
  TFooterOnelineLink,
  THeaderLayout,
  TInlineTagLayout,
  TKanbanBoard,
  TKanbanCardLayout,
  TKanbanLayout,
  TLinkItem,
  TLocale,
  TMediaReport,
  TModerator,
  TNameAlias,
  TNavActiveLayout,
  TPostLayout,
  TResolvedThemePreset,
  TSizeSML,
  TSocialItem,
  TTagGroup,
  TTagLayout,
  TThemePreset,
  TThemePresetOption,
  TThemePresetOverwrite,
  TThread,
  TThirdPartyAnalyticsConfig,
} from '~/spec'

type TDsbDocFile = {
  index: number
  name: string
  articleId: string
  linkAddr: string
}

type TDsbGroupCategory = {
  name: string
  index: number
  color: TColorName
  files: readonly TDsbDocFile[]
}

export type TDsbFieldMap = {
  favicon: string
  logo: string
  locale: TLocale
  title: string
  slug: string
  desc: string
  introduction: string
  homepage: string
  city: string
  techstack: string

  socialLinks: readonly TSocialItem[]
  mediaReports: readonly TMediaReport[]
  thirdPartyAnalytics: readonly TThirdPartyAnalyticsConfig[]
  enabledThirdPartyAnalytics: readonly TThirdPartyAnalyticsConfig[]
  umamiWebsiteId: string

  themePreset: TThemePreset
  themePresetBase: TThemePreset | null
  themeTokens: Partial<TResolvedThemePreset>
  themePresets: readonly TThemePresetOption[]
  themeOverwrite: TThemePresetOverwrite

  seoEnable: boolean
  ogSiteName: string
  ogTitle: string
  ogDescription: string
  ogUrl: string
  ogImage: string
  ogLocale: string
  ogPublisher: string

  twTitle: string
  twDescription: string
  twUrl: string
  twCard: string
  twSite: string
  twImage: string
  twImageWidth: string
  twImageHeight: string

  postLayout: TPostLayout
  kanbanLayout: TKanbanLayout
  kanbanCardLayout: TKanbanCardLayout
  kanbanBoards: readonly TKanbanBoard[]
  kanbanBgColors: readonly TColorName[]
  docCoverLayout: TDocCoverLayout
  docFaqLayout: TDocFAQLayout
  tagLayout: TTagLayout
  inlineTagLayout: TInlineTagLayout
  avatarLayout: TAvatarLayout
  brandLayout: TBrandLayout
  communityLayout: TCommunityLayout
  navActiveLayout: TNavActiveLayout
  topbarEnabled: boolean
  topbarBg: TColorName
  topbarBgCustomColor: string

  broadcastLayout: TBroadcastLayout
  broadcastBg: TColorName
  broadcastCustomBg: string
  broadcastEnable: boolean
  broadcastArticleLayout: TBroadcastArticleLayout
  broadcastArticleBg: TColorName
  broadcastArticleCustomBg: string
  broadcastArticleEnable: boolean
  changelogLayout: TChangelogLayout

  docCategories: readonly TDsbGroupCategory[]
  overlayDark: boolean

  tagGroups: readonly TTagGroup[]
  activeTagGroup: string | null
  activeTagThread: TThread | null
  nameAlias: readonly TNameAlias[]
  enable: TEnableConf
  docFaq: TDocFaq
  headerLayout: THeaderLayout
  footerLayout: TFooterLayout
  footerLinks: readonly TLinkItem[]
  footerOnelineLinks: readonly TFooterOnelineLink[]
  headerLinks: readonly TLinkItem[]

  widgetsPrimaryColor: TColorName
  widgetsThreads: readonly TThread[]
  widgetsSize: TSizeSML
}

export type TDsbFieldKey = keyof TDsbFieldMap
export type TDsbEditableFieldKey = TDsbFieldKey
export type TDsbTouchedFields = Partial<Record<TDsbEditableFieldKey, true>>

export type TDocFaqSaveZone =
  | { type: 'title' }
  | { type: 'desc' }
  | { type: 'groupTitle'; groupId: string }
  | { type: 'itemTitle'; groupId: string; itemId: string }
  | { type: 'itemDetail'; groupId: string; itemId: string }
  | { type: 'mode' }
  | { type: 'listOrder' }
  | null

export type TChangeTagMode = 'settingTag' | 'editingTag'
