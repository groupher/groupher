import type { TSimpleUser } from './account'
import type { TDsb, TParseDashboard } from './dashboard'
import type { TThread, TCommunityThread } from './thread'
import type { TID, TPagi } from './utils'
import type { TParsedWallpaper } from './wallpaper'

type TMeta = {
  postsCount?: number
  docsCount?: number
  blogsCount?: number
  changelogsCount?: number
}

export type TModerator = {
  isRoot?: boolean
  passportItemCount: number
  user: TSimpleUser
  pending?: boolean
}

export type TCommunity = {
  id?: string
  index?: number
  title?: string
  logo?: string
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
  moderators?: readonly TModerator[]
  views?: number

  // TODO:
  dashboard?: TDsb
}

export type TCommunityInfo = {
  community: TCommunity
  dashboard?: TParseDashboard
  wallpaper?: TParsedWallpaper
}

export type TPagedCommunities = {
  entries: readonly TCommunity[]
} & TPagi

export type TTag = {
  id?: string
  groupId?: string
  index?: number
  title?: string
  slug?: string
  layout?: string
  desc?: string
  thread?: TThread
  color?: string
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
