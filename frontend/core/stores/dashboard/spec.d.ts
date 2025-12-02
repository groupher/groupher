import type {
  DSB_ALIAS_ROUTE,
  DSB_BASEINFO_ROUTE,
  DSB_BROADCAST_ROUTE,
  DSB_DOC_ROUTE,
  DSB_LAYOUT_ROUTE,
  DSB_ROUTE,
  DSB_SEO_ROUTE,
} from '~/const/route'
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
  TKanbanCardLayout,
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
  TTopbarLayout,
  TUser,
  TValueOf,
  TWidgetType,
} from '~/spec'

export type { TRootStore } from '../spec'

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
  files: TFile[]
}

export type TDsbFields = {
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
  socialLinks: TSocialItem[]
  mediaReports: TMediaReport[]

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
  postLayout: TPostLayout
  kanbanLayout: TKanbanLayout
  kanbanCardLayout: TKanbanCardLayout
  kanbanBgColors: TColorName[]

  docLayout: TDocLayout
  docFaqLayout: TDocFAQLayout
  tagLayout: TTagLayout
  avatarLayout: TAvatarLayout
  brandLayout: TBrandLayout
  bannerLayout: TBannerLayout
  topbarLayout: TTopbarLayout
  topbarBg: TColorName

  broadcastLayout: TBroadcastLayout
  broadcastBg: TColorName
  broadcastEnable: boolean
  broadcastArticleLayout: TBroadcastArticleLayout

  broadcastArticleBg: TColorName
  broadcastArticleEnable: boolean

  changelogLayout: TChangelogLayout

  // doc
  docCategories: TGroupCategory[]

  // glow effect
  glowType: string
  glowFixed: boolean
  glowOpacity: string

  // goss blur
  gossBlur: int
  gossBlurDark: int

  // contents
  // tags
  tags: TTag[]
  activeTagGroup: string | null
  activeTagThread: string | null
  nameAlias: TNameAlias[]
  enable: TEnableConf

  faqSections: TFAQSection[]
  rssFeedType: TRSSType
  rssFeedCount: number

  headerLayout: THeaderLayout
  footerLayout: TFooterLayout

  footerLinks: TLinkItem[]
  headerLinks: TLinkItem[]

  moderators: TModerator[]

  // widgets
  widgetsPrimaryColor: TColorName
  widgetsThreads: TThread[]
  widgetsSize: TSizeSML
  widgetsType: TWidgetType
}

export type TInit = Partial<TDsbFields>

export type TStore = TDsbFields & {
  initFilled: boolean
  original: TDsbFields

  savingField: string | null
  saving: boolean
  loading: boolean

  curTab: TValueOf<typeof DSB_ROUTE>
  baseInfoTab: TValueOf<typeof DSB_BASEINFO_ROUTE>
  aliasTab: TValueOf<typeof DSB_ALIAS_ROUTE>
  seoTab: TValueOf<typeof DSB_SEO_ROUTE>
  docTab: TValueOf<typeof DSB_DOC_ROUTE>
  layoutTab: TValueOf<typeof DSB_LAYOUT_ROUTE>
  broadcastTab: TValueOf<typeof DSB_BROADCAST_ROUTE>

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
  batchSelectedIDs: string[]
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
  files: TDocFile[]
}

export type TDocSettings = {
  categories: TDocCategory[]
}

export type THeaderEditType = 'logo' | 'title'
export type TFooterEditType = THeaderEditType | 'social'

export type TChangeTagMode = 'settingTag' | 'editingTag'

export type TSEOFields =
  | 'seoEnable'
  | 'ogSiteName'
  | 'ogTitle'
  | 'ogDescription'
  | 'ogUrl'
  | 'ogImage'
  | 'twTitle'
  | 'twDescription'
  | 'twUrl'
  | 'twCard'
  | 'twSite'
  | 'twImage'
  | 'twImageWidth'
  | 'twImageHeight'

export type TDsbField =
  | 'baseInfo'
  | 'mediaReports'
  | 'socialLinks'
  | 'seo'
  | 'favicon'
  | 'logo'
  | 'locale'
  | 'title'
  | 'slug'
  | 'desc'
  | 'introduction'
  | 'homepage'
  | 'techstack'
  | 'city'
  | 'primaryColor'
  | 'postLayout'
  | 'kanbanLayout'
  | 'kanbanCardLayout'
  | 'kanbanBgColors'
  | 'brandLayout'
  | 'tagLayout'
  | 'avatarLayout'
  | 'bannerLayout'
  | 'headerLayout'
  | 'footerLayout'
  | 'glowType'
  | 'glowFixed'
  | 'glowOpacity'
  | 'gossBlur'
  | 'gossBlurDark'
  | 'headerLinks'
  | 'footerLinks'
  | 'docLayout'
  | 'docFaqLayout'
  | 'topbarLayout'
  | 'topbarBg'
  | 'broadcastLayout'
  | 'broadcastBg'
  | 'broadcastEnable'
  | 'broadcastArticleLayout'
  | 'broadcastArticleBg'
  | 'broadcastArticleEnable'
  | 'changelogLayout'
  | 'tag'
  | 'tagIndex'
  | 'faqSections'
  | 'faqSectionItem'
  | 'faqSectionAdd'
  | 'faqSectionDelete'
  | 'nameAlias'
  | 'rssFeedType'
  | 'rssFeedCount'
  | 'enable'
  | 'widgetsPrimaryColor'
  | 'widgetsThreads'
  | 'widgetsSize'
  | 'widgetsType'
  | 'activeTagGroup'
  | 'layoutTab'
  | 'seoTab'
  | 'ogSiteName'
  | 'ogTitle'
  | 'ogDescription'
  | 'ogUrl'
  | 'ogImage'
  | 'broadcastTab'
  | 'docTab'
  | 'twTitle'
  | 'twDescription'
  | 'twUrl'
  | 'twSite'
  | 'twCard'
  | 'pageBg'
  | 'pageBgDark'
  | TSEOFields
