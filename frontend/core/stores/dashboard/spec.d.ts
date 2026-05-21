import type { TResolvedThemePreset } from '~/lib/themePreset'
import type {
  TAvatarLayout,
  TCommunityLayout,
  TBrandLayout,
  TBroadcastArticleLayout,
  TBroadcastLayout,
  TChangelogLayout,
  TChangeMode,
  TColorName,
  TDocFAQLayout,
  TDocCoverLayout,
  TEnableConf,
  TFAQSection,
  TFooterLayout,
  TFooterOnelineLink,
  THeaderLayout,
  TLinkItem,
  TInlineTagLayout,
  TKanbanCardLayout,
  TKanbanBoard,
  TKanbanLayout,
  TLinkDraftItem,
  TLocale,
  TMediaReport,
  TModerator,
  TNavActiveLayout,
  TNameAlias,
  TOverview,
  TPagedArticles,
  TPagedCommunities,
  TPostLayout,
  TRSSType,
  TSizeSML,
  TSocialItem,
  TTagGroup,
  TTagLayout,
  TThemePreset,
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
  themePreset: TThemePreset
  themeTokens: Partial<TResolvedThemePreset>
  pageBg: string
  pageBgDark: string
  pageCustomBg: number
  pageCustomBgDark: number
  pageCustomIntensity: number
  pageCustomIntensityDark: number

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
  textTitle: string
  textDigest: string
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

  // doc
  docCategories: readonly TGroupCategory[]

  overlayDark: boolean

  // gauss blur
  gaussBlur: number
  gaussBlurDark: number

  // contents
  // tags
  tagGroups: readonly TTagGroup[]
  activeTagGroup: string | null
  activeTagThread: TThread | null
  nameAlias: readonly TNameAlias[]
  enable: TEnableConf

  faqSections: readonly TFAQSection[]
  rssFeedType: TRSSType
  rssFeedCount: number

  headerLayout: THeaderLayout
  footerLayout: TFooterLayout

  footerLinks: readonly TLinkItem[]
  footerOnelineLinks: readonly TFooterOnelineLink[]
  headerLinks: readonly TLinkItem[]

  moderators: readonly TModerator[]

  // widgets
  widgetsPrimaryColor: TColorName
  widgetsThreads: readonly TThread[]
  widgetsSize: TSizeSML
}

export type TInit = {
  metric?: TMetric
  now?: number
  initFilled?: boolean
  original?: TDsbFieldMap
} & Partial<TDsbFieldMap>
export type TDsbStoreFieldKey = keyof TDsbFieldMap
export type TDsbTouchedFields = Partial<Record<TDsbStoreFieldKey, true>>

export type TStore = TDsbFieldMap & {
  metric?: TMetric
  now?: number
  initFilled: boolean
  original: TDsbFieldMap
  // Fields that are currently different from original.
  touchedFields: TDsbTouchedFields

  savingField: string | null
  saving: boolean
  loading: boolean

  overview: TOverview

  editingTag: TTag | null
  settingTag: TTag | null
  editingAlias: TNameAlias | null
  editingLink: TLinkDraftItem | null
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
  // Low-level state patch. Does not update dirty/touched state.
  commit: (patch: Partial<TStore>) => void
  // Update one persisted dashboard field and refresh its cached dirty state.
  editField: <K extends TDsbStoreFieldKey>(field: K, value: TDsbFieldMap[K]) => void
  // Batch version of editField for draft confirmations that update multiple persisted fields.
  editFields: (patch: Partial<TDsbFieldMap>) => void
  // After save succeeds, accept current values as the new original and clear touched.
  // Example: saving FIELD.TITLE turns current title into original.title, so the Save button becomes untouched.
  markFieldsToOriginal: (fields: readonly TDsbStoreFieldKey[]) => void
  // Restore current values from original and clear cached dirty state for those fields.
  rollbackFields: (fields: readonly TDsbStoreFieldKey[]) => void
  isTouched: (field: TDsbStoreFieldKey) => boolean
  anyTouched: (fields: readonly TDsbStoreFieldKey[]) => boolean
  debug: () => void
}

export type TLinkState = {
  editingLink: TLinkDraftItem | null
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
