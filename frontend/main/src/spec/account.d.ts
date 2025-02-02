import type { TPagi } from './utils'
import type { TPagedCommunities } from './community'

type TSocial = {
  github?: string
  twitter?: string
  blog?: string
  company?: string
}

export type TSimpleUser = {
  login?: string
  nickname?: string
  name?: string
  bio?: string
  shortbio?: string
  avatar?: string
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

export type TUser = TSimpleUser & {
  id?: string
  // TODO: figure it out
  extraId?: string
  // editableCommunities?: TPagedCommunities
  sex?: string
  location?: string
  geoCity?: string
  viewerHasFollowed?: boolean
  social?: TSocial
  email?: string
  contributes?: TContributes
  followersCount?: number
  followingsCount?: number
  insertedAt?: string
  views?: number
  meta?: {
    isMaker: boolean
    publishedPostsCount: number
    publishedJobsCount: number
    publishedBlogsCount: number
    publishedWorksCount: number | null
    publishedRadarsCount: number
    publishedMeetupsCount: number
  }
}

export type TPagedUsers = {
  entries: TUser[]
} & TPagi

export type TAccount = TUser & {
  isLogin?: boolean
  isValidSession?: boolean
  subscribedCommunitiesCount?: number
  isModerator?: boolean
  // ...
}

export type TMembership = 'seniorMember' | 'sponsorMember' | 'donateMember'
