/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/extensions */
import type { TArticle } from './article'
import type { TCommunity } from './community'
import type { TThemeName } from './theme'

export type { TAccount, TMembership, TPagedUsers, TSimpleUser, TUser } from './account'
export type {
  TArticle,
  TArticleCat,
  TArticleCatMode,
  TArticleCatReject,
  TArticleEntries,
  TArticleFilter,
  TArticleFilterMode,
  TArticleMeta,
  TArticleOrder,
  TArticleParams,
  TArticlePubSelector,
  TArticleState,
  TArticleTitle,
  TChangelog,
  TCollectionFolder,
  TComment,
  TCommentsState,
  TCopyright,
  TDocument,
  TFAQSection,
  TPagedArticles,
  TPagedArticlesParams,
  TPagedChangelogs,
  TPagedCollectionFolder,
  TPagedComments,
  TPagedDocs,
  TPagedPosts,
  TPost,
  TSocialInfo,
  TTechCommunities,
  TTechStack,
  TUpvoteLayout,
  TViewingInfo,
} from './article'
export type { TColor, TColorName, TPrimaryColor } from './color'
export type {
  TCategory,
  TCommunity,
  TCommunityInfo,
  TGroupedTags,
  TModerator,
  TPagedCommunities,
  TPagedTags,
  TTag,
} from './community'
export type { TButton, TButtonStyle, TFiltersMenuItems } from './comp'
export type {
  TAvatarLayout,
  TBannerLayout,
  TBrandLayout,
  TBroadcastArticleLayout,
  TBroadcastConfig,
  TBroadcastLayout,
  TChangelogLayout,
  TDashboard,
  TDashboardSEOConfig,
  TDashboardThreadConfig,
  TDocFAQLayout,
  TDocLayout,
  TEditFunc,
  TEnableConfig,
  TFooterLayout,
  THeaderLayout,
  TKanbanCardLayout,
  TKanbanLayout,
  TMediaReport,
  TNameAlias,
  TOverview,
  TParseDashboard,
  TPostLayout,
  TRSSType,
  TTagLayout,
  TTopbarLayout,
} from './dashboard'
export type { TEmotion, TEmotionType } from './emotion'
export type {
  TFlattenObjectKeys,
  TNegativeInteger,
  TNonNegativeInteger,
  TSnakeUpperCase,
  TValueOf,
} from './enhance'
export type {
  TGallery,
  TGallery2Column,
  TGallery3Column,
  TGalleryDefault,
  TGalleryList,
  TGalleryMainColumn,
  TGalleryMasonryCollumn,
  TGalleryTextOnly,
  TGalleryTextWithImage,
} from './gallery'
export type { TGQLError } from './graphql'
export type { TLocale, TTransKey } from './i18n'
export type { TMenu } from './menu'
export type { TMetric } from './metric'
export type {
  TDashboardAliasRoute,
  TDashboardBaseInfoRoute,
  TDashboardBroadcastRoute,
  TDashboardDocRoute,
  TDashboardLayoutRoute,
  TDashboardPath,
  TDashboardSEORoute,
  TPath,
} from './route'
export type {
  TSize,
  TSizeH,
  TSizeL,
  TSizeM,
  TSizeS,
  TSizeSM,
  TSizeSML,
  TSizeT,
  TSizeTS,
  TSizeTSM,
} from './size'
export type { TAccountStore, TViewingStore } from './store'
export type { TFlatThemeKey, TTheme, TThemeMap, TThemeName } from './theme'
export type { TArticleListThread, TArticleThread, TCommunityThread, TThread } from './thread'
export type {
  Nullable,
  TActive,
  TAttInfo,
  TButtonPrefix,
  TChangeMode,
  TCityOption,
  TCommunitySetterStyle,
  TConditionMode,
  TDashboardLayout,
  TDirection,
  TEditMode,
  TEditValue,
  TFlexRule,
  TGAEvent,
  TGQError,
  TGroupedLinks,
  TID,
  TInput,
  TLink,
  TLinkItem,
  TMenuOption,
  TModelineType,
  TOnlineStatus,
  TPagi,
  TPaymentMethod,
  TPaymentUsage,
  TPlatform,
  TPublishMode,
  TReportType,
  TResState,
  TScrollDirection,
  TSelectOption,
  TSocial,
  TSocialItem,
  TSocialType,
  TSpace,
  TSubmitState,
  TTabItem,
  TTechStackCategory,
  TTestable,
  TToastType,
  TTooltipAnimation,
  TTooltipPlacement,
  TUploadPreview,
  TUserActivity,
  TView,
  TWidgetType,
  TZIndexType,
  TArticleLoad
} from './utils'
export type {
  TCustomWallpaper,
  TParsedWallpaper,
  TWallpaper,
  TWallpaperData,
  TWallpaperFmt,
  TWallpaperGradient,
  TWallpaperGradientDir,
  TWallpaperInfo,
  TWallpaperPic,
  TWallpaperType,
} from './wallpaper'

export type TRoute = {
  communityPath?: string
  threadPath?: string
  mainPath?: string
  subPath?: string
}

export type TViewing = TCommunity | TArticle

export type TContainer = 'body' | 'drawer'

export type TGlowPosition = 'fixed' | 'absolute'
export type TGlowEffect = {
  glowType: string
  glowPosition?: TGlowPosition
  glowFixed?: boolean
  glowOpacity?: string
  $theme?: TThemeName

  changeGlowEffect?: (effect: string) => void
}

interface IWindow extends Window {
  appVersion?: string
  /**
   * used for check platform hook
   */

  chrome?: any
  safari?: any
  StyleMedia?: any
  HTMLElement?: any

  // for baidu analysis
  _hmt?: any
}

export type TWindow = IWindow | null

export type TPathQuery =
  | 'pagedDocs'
  | 'pagedChangelogs'
  | 'pagedBlogs'
  | 'pagedPosts'
  | 'doc'
  | 'changelog'
  | 'blog'
  | 'post'
  | 'community'
  | 'tags'
  | 'kanbanPosts'

export type TSearchParams = { [key: string]: string | string[] | undefined }

export type TUrlInfo = {
  pathname: string
  searchParams: URLSearchParams
}
