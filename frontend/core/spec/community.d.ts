import type { TSimpleUse } from './account'
import type { TDashboard, TParseDashboard } from './dashboard'
import type { TID, TPagi } from './utils'
import type { TParsedWallpaper } from './wallpaper'

type TMeta = {
  postsCount: number
  docsCount: number
  blogsCount: number
  changelogsCount: number
}

export type TModerator = {
  role: string
  passportItemCount: number
  user: TSimpleUse
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
  contributesDigest?: number[]
  moderatorsCount?: number
  desc?: string
  meta?: TMeta
  threads?: TCommunityThread[]
  pending?: number
  moderators?: TModerator[]
  views?: number

  // TODO:
  dashboard?: TDashboard
}

export type TCommunityInfo = {
  community: TCommunity
  dashboard?: TParseDashboard
  wallpaper?: TParsedWallpaper
}

export type TPagedCommunities = {
  entries: TCommunity[]
} & TPagi

export type TTag = {
  id?: string
  index?: number
  title?: string
  slug: string
  layout?: string
  desc?: string
  thread?: string
  color?: string
  group?: string
  community?: TCommunity
  insertedAt?: string
  updatedAt?: string
}

export type TPagedTags = {
  entries: TTag[]
} & TPagi

// for cool-guide, awesome sort thing

export type TGroupedTags = {
  [group: string]: TTag[]
}[]

export type TCategory = {
  id: TID
  title: string
  slug: string
  index: number
  // author: T
}
