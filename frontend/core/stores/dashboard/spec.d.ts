import type {
  TAvatarLayout,
  TBannerLayout,
  TBrandLayout,
  TBroadcastArticleLayout,
  TBroadcastLayout,
  TChangelogLayout,
  TChangeMode,
  TColorName,
  TDocFAQLayout,
  TDocLayout,
  TEnableConf,
  TFAQSection,
  TFooterLayout,
  THeaderLayout,
  TInlineTagLayout,
  TKanbanCardLayout,
  TKanbanBoard,
  TKanbanLayout,
  TLinkItem,
  TLocale,
  TMediaReport,
  TModerator,
  TNameAlias,
  TOverview,
  TPagedArticles,
  TPagedCommunities,
  TPostLayout,
  TRSSType,
  TSizeSML,
  TSocialItem,
  TTag,
  TTagLayout,
  TThread,
  TUser,
} from '~/spec'

type TFile = {
  index: number
  name: string
  articleId: string
  linkAddr: string
}

type TGroupCategory = {
  name: string
  index: number
  color: TColorName
  files: readonly TFile[]
}

export type TDsbFieldMap = {
  // baseInfo
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

  // social
  socialLinks: readonly TSocialItem[]
  mediaReports: readonly TMediaReport[]

  // page
  pageBg: string
  pageBgDark: string

  // seo
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

  // layout
  primaryColor: TColorName
  primaryCustomColor: string
  subPrimaryColor: TColorName
  subPrimaryCustomColor: string
  postLayout: TPostLayout
  kanbanLayout: TKanbanLayout
  kanbanCardLayout: TKanbanCardLayout
  kanbanBoards: readonly TKanbanBoard[]
  kanbanBgColors: readonly TColorName[]

  docLayout: TDocLayout
  docFaqLayout: TDocFAQLayout
  tagLayout: TTagLayout
  inlineTagLayout: TInlineTagLayout
  avatarLayout: TAvatarLayout
  brandLayout: TBrandLayout
  bannerLayout: TBannerLayout
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

  // doc
  docCategories: readonly TGroupCategory[]

  // glow effect
  glowType: string
  glowFixed: boolean
  glowOpacity: string

  darkFloat: boolean

  // gauss blur
  gaussBlur: int
  gaussBlurDark: int

  // contents
  // tags
  tags: readonly TTag[]
  activeTagGroup: string | null
  activeTagThread: string | null
  nameAlias: readonly TNameAlias[]
  enable: TEnableConf

  faqSections: readonly TFAQSection[]
  rssFeedType: TRSSType
  rssFeedCount: number

  headerLayout: THeaderLayout
  footerLayout: TFooterLayout

  footerLinks: readonly TLinkItem[]
  headerLinks: readonly TLinkItem[]

  moderators: readonly TModerator[]

  // widgets
  widgetsPrimaryColor: TColorName
  widgetsThreads: readonly TThread[]
  widgetsSize: TSizeSML
}

export type TInit = { metric?: TMetric; now?: number } & Partial<TDsbFieldMap>

export type TStore = TDsbFieldMap & {
  metric?: TMetric
  now?: number
  initFilled: boolean
  original: TDsbFieldMap

  savingField: string | null
  saving: boolean
  loading: boolean

  overview: TOverview

  editingTag: TTag | null
  settingTag: TTag | null
  editingAlias: TNameAlias | null
  editingLink: TLinkItem
  editingLinkMode: TChangeMode

  editingGroup: string | null
  editingGroupIndex: number | null
  editingFAQIndex: number | null
  editingFAQ: TFAQSection | null

  queryingMediaReportIndex: number

  // cms
  batchSelectedIDs: readonly string[]
  pagedCommunities: TPagedCommunities
  pagedPosts: TPagedArticles
  pagedDocs: TPagedArticles
  pagedChangelogs: TPagedArticles

  // for global alert
  demoAlertEnable: boolean

  // for admins
  activeModerator: TUser | null
  allModeratorRules: string
  allRootRules: string

  // actions
  commit: (patch: Partial<TStore>) => void
  debug: () => void
}

export type TLinkState = {
  editingLink: TLinkItem
  saving: boolean
  editingLinkMode: TChangeMode
  editingGroup: string | null
  editingGroupIndex: number | null
}

type TDocFile = {
  index: number
  name: string
  articleId: string
  linkAddr: string
}

type TDocCategory = {
  name: string
  index: number
  color: TColorName
  files: readonly TDocFile[]
}

export type TDocSettings = {
  categories: readonly TDocCategory[]
}

export type THeaderEditType = 'logo' | 'title'
export type TFooterEditType = THeaderEditType | 'social'

export type TChangeTagMode = 'settingTag' | 'editingTag'
