import type {
  ARTICLE_CAT,
  ARTICLE_CAT_MODE,
  ARTICLE_STATUS_REJECT,
  ARTICLE_ORDER,
  ARTICLE_STATUS,
} from '~/const/gtd'
import type { UPVOTE_LAYOUT } from '~/const/layout'
import type { ArticleEmotion, EmotionType, ReactionOutcome } from '~/lib/graphql/generated/graphql'
import type { TConstValues } from '~/spec'

import type { TCommunity, TTag } from '.'
import type { TAccount, TSimpleUser, TUser } from './account'
import type { TColor } from './color'
import type { TEmotion } from './emotion'
import type { TGraphQLPagiPageInfo } from './pagination'
import type { TArticleThread, TThread } from './thread'
import type { TID } from './utils'

export type TArticleTitle = {
  $isPinned?: boolean
  viewerHasViewed?: boolean
} & TColor

export type TCopyright = 'cc' | 'approve' | 'forbid'

export type TArticleMeta = {
  thread?: TThread
  citingCount?: number
  isCommentLocked?: boolean
  isEdited?: boolean
  lastActiveAt?: string
  latestUpvotedUsers?: readonly TUser[]
}

export type TDocument = {
  json?: string
  html?: string
  markdown?: string
  toc?: Record<string, unknown>
  rss?: string
  body?: TDocument
  bodyVersion?: number
}

export type TViewingInfo = {
  community: string
  id: TID
}

export type TArticleStats = {
  community: string
  thread: TArticleThread
  innerId: string
  views: number
  viewsRevision: number
  upvotesCount: number
  commentsCount: number
  collectsCount: number
  commentsParticipantsCount: number
  interactionRevision: number
  commentsRevision: number
  emotionCounts: Array<{ type: ArticleEmotion; count: number }>
  snapshotAt: string
}

export type TArticleViewerState = {
  articleKey: string
  viewerHasViewed?: boolean
  viewerHasUpvoted?: boolean
  viewerHasCollected?: boolean
  viewerEmotion?: EmotionType | null
  interactionRevision?: number
}

type TBaseArticle = {
  thread?: TArticleThread
  id?: TID
  innerId?: TID
  version?: number
  title?: string
  digest?: string | null
  body?: TDocument
  copyRight?: string
  isQuestion?: boolean
  isPinned?: boolean
  author?: TAccount
  upvotesCount?: never
  community?: TCommunity
  communities?: readonly TCommunity[]
  commentsParticipants?: readonly TUser[]
  insertedAt?: string
  updatedAt?: string
  commentsCount?: never
  communityTags?: readonly TTag[]
  meta?: TArticleMeta
  linkAddr?: string
  isArchived?: boolean
  archivedAt?: string
  activeAt?: string | null

  cat?: TArticleCat | null
  status?: TArticleStatus | null

  // for dashboard cmd tmp check status
  _checked?: boolean
}

export type TPost = TBaseArticle & {
  digest?: string | null
  isSolved?: boolean
  solutionCommentId?: TID
  solutionDigest?: string
}

export type TChangelog = TBaseArticle & {
  digest?: string | null
}

export type TDoc = TBaseArticle & {
  digest?: string | null
  subtitle?: string
}

export type TTechStack = {
  title?: string
  logo: string
  slug: string
  category?: string
}

export type TSocialInfo = { platform: string; link: string }

export type TTechCommunities = {
  lang?: TCommunity[]
  framework?: TCommunity[]
  database?: TCommunity[]
  devOps?: TCommunity[]
  design?: TCommunity[]
}

export type TArticle = TPost

/** Strict detail view model; public content, aggregate stats, and viewer state have separate owners. */
export type TArticleState<T extends TArticle = TArticle> = {
  content: T
  stats: TArticleStats | null
  viewerState: TArticleViewerState
}

export type TPagedArticleViewModels<T extends TArticle = TArticle> = {
  entries: readonly TArticleState<T>[]
  pageInfo?: TGraphQLPagiPageInfo
}

export type TPagedPosts = {
  entries: readonly TPost[]
  pinnedEntries: readonly TPost[]
  pageInfo: TGraphQLPagiPageInfo
}
export type TPagedChangelogs = {
  entries: readonly TChangelog[]
  pinnedEntries: readonly TChangelog[]
  pageInfo: TGraphQLPagiPageInfo
}
export type TPagedDocs = {
  entries: readonly TDoc[]
  pinnedEntries: readonly TDoc[]
  pageInfo: TGraphQLPagiPageInfo
}
export type TArticleEntries = readonly TPost[] | readonly TChangelog[] | readonly TDoc[]
export type TPagedArticles = {
  entries: TArticleEntries
  pinnedEntries: TArticleEntries
  pageInfo: TGraphQLPagiPageInfo
}

export type TComment = {
  rootInnerId?: string | null
  innerId: string
  thread?: TThread
  isPinned?: boolean
  isSolution?: boolean
  floor?: number
  body?: TDocument
  bodyVersion?: number
  insertedAt?: string
  updatedAt?: string
  author?: TUser
  repliesCount?: number
  replies?: TComment[]
  replyToComment?: TComment | null
  upvotesCount?: number
  commentInteractionRevision?: number
  reactionOutcome?: ReactionOutcome
  viewerHasUpvoted?: boolean
  isArticleAuthor?: boolean
  emotions?: TEmotion[]
  meta?: {
    isArticleAuthorUpvoted?: boolean
    isReplyToOthers?: boolean
  }
  article?: {
    innerId?: string
    title?: string
    thread?: TThread
    commentsRevision?: number
    author?: {
      login
      nickname
      avatar
    }
  }
}

export type TPagedComments = {
  entries: TComment[]
  pageInfo: TGraphQLPagiPageInfo
}

export type TArticleFilter = {
  order?: TArticleOrder
  cat?: TArticleCat | null
  status?: TArticleStatus | null
}

export type TArticleFilterMode = 'default' | 'modeline'

export type TArticleCatMode = TConstValues<typeof ARTICLE_CAT_MODE>
export type TUpvoteLayout = TConstValues<typeof UPVOTE_LAYOUT>

export type TCollectionFolder = {
  id: TID
  title: string
  desc?: string
  totalCount: number
  private: boolean
  updatedAt: string
}

export type TPagedCollectionFolder = {
  entries: TCollectionFolder[]
  pageInfo: TGraphQLPagiPageInfo
}

export type TCommentsState = {
  isViewerJoined: boolean
  participantsCount: number
  totalCount: number
  participants: TSimpleUser[]
}

export type TArticleStatusReject = TConstValues<typeof ARTICLE_STATUS_REJECT>
export type TArticleStatus = TConstValues<typeof ARTICLE_STATUS>
export type TArticleOrder = TConstValues<typeof ARTICLE_ORDER>
export type TArticleCat = TConstValues<typeof ARTICLE_CAT>

export type TArticlePubSelector = {
  cat?: TArticleCat | null
  tag?: TTag | null
}

export type TFAQSection = {
  id: string
  title: string
  body: string
  index: number
}

export type TPagedArticlesParams = {
  after?: string
  page?: number
  size?: number
  community?: string
  communityTag?: string
  communityTags?: string[]
  cat?: string
  status?: string
  statuses?: string[]
  order?: string
  when?: string
  sort?: string
}

export type TArticleParams = {
  community: string
  id: string
}
