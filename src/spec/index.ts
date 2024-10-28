/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable import/no-unresolved */
/* eslint-disable import/extensions */
import type { TThemeName } from './theme'
import type { TArticle } from './article'
import type { TCommunity } from './community'

export type { TTransKey, TLocale } from './i18n'

export type {
  TSnakeUpperCase,
  TNegativeInteger,
  TNonNegativeInteger,
  TValueOf,
  TFlattenObjectKeys,
} from './enhance'

export type { TMetric } from './metric'
export type {
  TSize,
  TSizeT,
  TSizeS,
  TSizeM,
  TSizeL,
  TSizeTS,
  TSizeTSM,
  TSizeSML,
  TSizeSM,
  TSizeH,
} from './size'
export type { TButton, TButtonStyle, TFiltersMenuItems } from './comp'
export type { TTheme, TThemeMap, TThemeName } from './theme'
export type { TAccount, TUser, TPagedUsers, TSimpleUser, TMembership } from './account'
export type {
  TCommunity,
  TModerator,
  TPagedCommunities,
  TTag,
  TNaviTag,
  TFilterTag,
  TGroupedTags,
  TCategory,
} from './community'

export type { TThread, TArticleThread, TCommunityThread } from './thread'

export type {
  TID,
  TTestable,
  TActive,
  TSpace,
  TGAEvent,
  TLink,
  TPlatform,
  Nullable,
  TDirection,
  TScrollDirection,
  TTooltipAnimation,
  TTooltipPlacement,
  TReportType,
  TAttInfo,
  TTabItem,
  TResState,
  TPaymentUsage,
  TPaymentMethod,
  TFlexRule,
  TGQError,
  TInput,
  TEditValue,
  TSubmitState,
  TSelectOption,
  TCityOption,
  TTechStackCategory,
  TCommunitySetterStyle,
  TToastType,
  TView,
  TUserActivity,
  TEditMode,
  TOnlineStatus,
  TModelineType,
  TMenuOption,
  TPublishMode,
  TDashboardLayout,
  TSocial,
  TSocialType,
  TSocialItem,
  TLinkItem,
  TGroupedLinks,
  TChangeMode,
  TUploadPreview,
  TPagi,
  TConditionMode,
  TWidgetType,
  TButtonPrefix,
} from './utils'

export type { TGQLError } from './graphql'

export type {
  TTagLayout,
  TAvatarLayout,
  TTopbarLayout,
  TBrandLayout,
  TBannerLayout,
  TPostLayout,
  TKanbanLayout,
  TKanbanCardLayout,
  TChangelogLayout,
  TDocLayout,
  TDocFAQLayout,
  THeaderLayout,
  TFooterLayout,
  TBroadcastLayout,
  TBroadcastArticleLayout,
  TBroadcastConfig,
  TEnableConfig,
  TNameAlias,
  TDashboardThreadConfig,
  TDashboardSEOConfig,
  TRSSType,
  TMediaReport,
  TDashboard,
  TOverview,
  TEditFunc,
} from './dashboard'

export type {
  TCollectionFolder,
  TPagedCollectionFolder,
  TDocument,
  TArticle,
  TViewingInfo,
  TArticleEntries,
  TArticleMeta,
  TPost,
  TChangelog,
  TSocialInfo,
  TTechCommunities,
  TTechStack,
  TPagedArticles,
  TComment,
  TPagedComments,
  TArticleFilter,
  TArticleFilterMode,
  TArticleCatMode,
  TCopyright,
  TUpvoteLayout,
  TCommentsState,
  TArticleCat,
  TArticlePubSelector,
  TArticleCatReject,
  TArticleState,
  TFAQSection,
  TArticleTitle,
  TPagedPosts,
  TPagedChangelogs,
  TPagedDocs,
  TPagedArticlesParams,
  TArticleParams,
  TArticleOrder,
} from './article'

export type {
  TGallery,
  TGalleryDefault,
  TGalleryList,
  TGalleryMasonryCollumn,
  TGalleryMainColumn,
  TGallery2Column,
  TGallery3Column,
  TGalleryTextOnly,
  TGalleryTextWithImage,
} from './gallery'

export type { TMenu } from './menu'
export type { TAccountStore, TViewingStore } from './store'

export type { TEmotion, TEmotionType } from './emotion'

export type {
  TWallpaperPic,
  TWallpaperGradient,
  TWallpaperFmt,
  TWallpaper,
  TWallpaperType,
  TWallpaperGradientDir,
  TCustomWallpaper,
  TWallpaperInfo,
  TWallpaperData,
} from './wallpaper'

export type { TColorName, TPrimaryColor, TColor } from './color'

export type {
  TPath,
  TDashboardPath,
  TDashboardLayoutRoute,
  TDashboardBaseInfoRoute,
  TDashboardSEORoute,
  TDashboardDocRoute,
  TDashboardBroadcastRoute,
  TDashboardAliasRoute,
} from './route'

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
