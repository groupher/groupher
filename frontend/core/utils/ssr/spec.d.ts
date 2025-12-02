import type {
  TArticle,
  TCommunity,
  TDsbAliasRoute,
  TDsbBaseInfoRoute,
  TDsbBroadcastRoute,
  TDsbDocRoute,
  TDsbLayoutRoute,
  TDsbPath,
  TDsbSEORoute,
  TLocale,
  TPagedArticles,
  TTag,
} from '~/spec'

export type TSessionRes = TGQSSRResult & {
  sesstion: {
    theme: {
      theme: string
    }
    account: {
      user: TUser
      isValidSession: boolean
    }
  }
}
export type TCommunityRes = TGQSSRResult & { community: TCommunity }
export type TTagsRes = TGQSSRResult & { tags: TTag[] }
export type TPagedPostsRes = TGQSSRResult & { pagedPosts: TPagedArticles }
export type TPostRes = TGQSSRResult & { post: TArticle }
export type TChangelogRes = TGQSSRResult & { changelog: TArticle }
export type TPagedChangelogsRes = TGQSSRResult & { pagedChangelogs: TPagedArticles }

export type TGroupedKanbanPostsRes = TGQSSRResult & {
  groupedKanbanPosts: {
    todo: TPagedArticles
    wip: TPagedArticles
    done: TPagedArticles
  }
}

export type TRequestPolicy = 'cache-first' | 'cache-and-network' | 'network-only' | 'cache-only'

export type TSSRQueryOpt = {
  skip?: boolean
  // cache-first is the default
  requestPolicy?: TRequestPolicy
  userHasLogin?: boolean
}

export type TGQSSRResult = {
  error: boolean
  fetching: boolean
  stale: boolean
}

export type TTagsFilter = {
  community?: string
  thread?: string
}

export type TDsbTab = {
  curTab: TDsbPath
  baseInfoTab?: TDsbBaseInfoRoute
  seoTab?: TDsbSEORoute
  docTab?: TDsbDocRoute
  broadcastTab?: TDsbBroadcastRoute
  layoutTab?: TDsbLayoutRoute
  aliasTab?: TDsbAliasRoute
}

export type TFilterSearchParams = {
  activeCat?: string | null
  activeState?: string | null
}

export type TUseI18n = {
  locale: TLocale
  localeData: string
}
