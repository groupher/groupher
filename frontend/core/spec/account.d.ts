import type { TGraphQLPagiPageInfo } from './pagination'

// import type { TPagedCommunities } from './community'

type TUserSocial = {
  github?: string
  twitter?: string
  blog?: string
  company?: string
  zhihu?: string
  dribble?: string
  huaban?: string
  douban?: string
  pinterest?: string
}

export type TSimpleUser = {
  id?: string | null
  login?: string
  nickname?: string | null
  name?: string | null
  bio?: string | null
  shortbio?: string | null
  avatar?: string | null
}

type TContributes = {
  records?: {
    date: string
    count: number
  }
  startDate?: string
  endDate?: string
  totalCount?: number
}

export type TPassport = {
  global?: Record<string, boolean>
  [community: string]:
    | Record<string, boolean>
    | {
        root?: boolean
        cms?: Record<string, boolean>
        account?: Record<string, boolean>
      }
    | undefined
}

export type TUser = TSimpleUser & {
  // TODO: figure it out
  extraId?: string
  // editableCommunities?: TPagedCommunities
  sex?: string
  location?: string
  geoCity?: string
  viewerHasFollowed?: boolean
  social?: TUserSocial
  passport?: TPassport
  email?: string
  contributes?: TContributes
  followersCount?: number
  followingsCount?: number
  insertedAt?: string
  views?: number
  meta?: {
    isMaker: boolean
    publishedPostsCount: number
    publishedBlogsCount: number
  }
}

/** A validated signed-in user always has a Groupher login. */
export type TAuthenticatedUser = TUser & { login: string }

export type TPagedUsers = {
  entries: TUser[]
  pageInfo: TGraphQLPagiPageInfo
}

export type TAccount = TUser & {
  isLogin?: boolean
  isValidSession?: boolean
  subscribedCommunitiesCount?: number
  isModerator?: boolean
  // ...
}
