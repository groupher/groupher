import type { TSimpleUser } from './account'
import type { TDsbRaw, TDsb } from './dashboard'
import type { TMarkerValue } from './marker'
import type { TGraphQLPagiPageInfo } from './pagination'
import type { TThread, TCommunityThread } from './thread'
import type { TID } from './utils'
import type { TParsedWallpaper } from './wallpaper'

type TMeta = {
  postsCount?: number
  docsCount?: number
  blogsCount?: number
  changelogsCount?: number
}

export type TModerator = {
  memberId: string
  revision: number
  isLord: boolean
  permissions: string[]
  user: TSimpleUser
}

export type TCommunity = {
  id?: string
  ref?: string
  index?: number
  title?: string
  logo?: string | null
  slug: string
  locale?: string
  homepage?: string
  subscribersCount?: number
  articlesCount?: number
  viewerHasSubscribed?: boolean
  contributesDigest?: readonly number[]
  moderatorsCount?: number
  desc?: string
  meta?: TMeta
  threads?: readonly TCommunityThread[]
  pending?: number
  views?: number

  // TODO:
  dashboard?: TDsbRaw
}

export type TCommunityInfo = {
  community: TCommunity
  dashboard?: TDsb
  wallpaper?: TParsedWallpaper
}

export type TPagedCommunities = {
  entries: readonly TCommunity[]
  pageInfo: TGraphQLPagiPageInfo
}

export type TTag = {
  id?: string
  groupId?: string
  index?: number
  title?: string
  slug?: string
  layout?: string | null
  desc?: string
  thread?: TThread
  color?: string
  marker?: TMarkerValue | null
  group?: string
  community?: TCommunity
  insertedAt?: string
  updatedAt?: string
}

export type TTagGroup = {
  id: string
  title: string
  index: number
  tags: readonly TTag[]
}

export type TTagStats = {
  slug?: string
  contentsCount?: number
  todayContentsCount?: number
}

// for cool-guide, awesome sort thing

export type TGroupedTags = {
  [group: string]: TTag[]
}

export type TCategory = {
  id: TID
  title: string
  slug: string
  index: number
  // author: T
}
