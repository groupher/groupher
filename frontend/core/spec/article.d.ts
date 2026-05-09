import type {
  ARTICLE_CAT,
  ARTICLE_CAT_MODE,
  ARTICLE_STATUS_REJECT,
  ARTICLE_ORDER,
  ARTICLE_STATUS,
} from '~/const/gtd'
import type { UPVOTE_LAYOUT } from '~/const/layout'
import type { TConstValues } from '~/spec'

import type { TCommunity, TTag } from '.'
import type { TAccount, TSimpleUser, TUser } from './account'
import type { TColor } from './color'
import type { TEmotion } from './emotion'
import type { TThread } from './thread'
import type { TID, TPagi } from './utils'

export type TArticleTitle = { $isPinned?: boolean; viewerHasViewed?: boolean } & TColor

export type TCopyright = 'cc' | 'approve' | 'forbid'

export type TArticleMeta = {
  thread?: TThread
  citingCount?: number
  isCommentLocked?: boolean
  isEdited?: boolean
  lastActiveAt?: string
  latestUpvotedUsers?: readonly TUser[]
  isLegal?: boolean
  illegalReason?: readonly string[]
  illegalWords?: readonly string[]
}

export type TDocument = {
  json?: string
  html?: string
  markdown?: string
  markdownToc?: Record<string, unknown>
  rss?: string
  bodyHtml?: string
  body?: string
}

export type TViewingInfo = {
  community: string
  id: TID
}

type TBaseArticle = {
  id?: TID
  innerId?: TID
  title?: string
  digest?: string
  body?: string
  views?: number
  copyRight?: string
  isQuestion?: boolean
  isPinned?: boolean
  author?: TAccount
  upvotesCount?: number
  community?: TCommunity
  communitySlug?: string
  communities?: readonly TCommunity[]
  commentsParticipants?: readonly TUser[]
  commentsParticipantsCount?: number
  insertedAt?: string
  updatedAt?: string
  viewerHasViewed?: boolean
  viewerHasCollected?: boolean
  viewerHasUpvoted?: boolean
  commentsCount?: number
  communityTags?: readonly TTag[]
  meta?: TArticleMeta
  document?: TDocument
  linkAddr?: string
  isArchived?: boolean
  archivedAt?: string
  activeAt?: string

  cat?: TArticleCat
  status?: TArticleStatus

  // for dashboard cmd tmp check status
  _checked?: boolean
}

export type TPost = TBaseArticle & {
  digest?: string
}

export type TChangelog = TBaseArticle & {
  digest?: string
}

export type TDoc = TBaseArticle & {
  digest?: string
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

export type TPagedPosts = {
  entries: readonly TPost[]
} & TPagi

export type TPagedChangelogs = {
  entries: readonly TChangelog[]
} & TPagi

export type TPagedDocs = {
  entries: readonly TDoc[]
} & TPagi

export type TArticleEntries = readonly TPost[] | readonly TChangelog[] | readonly TDoc[]
export type TPagedArticles = {
  entries: TArticleEntries
} & TPagi

export type TComment = {
  id: string
  thread?: TThread
  isPinned?: boolean
  floor?: number
  bodyHtml?: string
  insertedAt?: string
  updatedAt?: string
  author?: TUser
  repliesCount?: number
  replies?: TComment[]
  replyTo?: TComment
  replyToId?: TID
  upvotesCount?: number
  viewerHasUpvoted?: boolean
  isArticleAuthor?: boolean
  emotions?: TEmotion[]
  meta?: {
    isArticleAuthorUpvoted?: boolean
    isReplyToOthers?: boolean
    isLegal?: boolean
    illegalReason?: string[]
    illegalWords?: string[]
  }
  article?: {
    id?: string
    title?: string
    thread?: TThread
    author?: {
      login
      nickname
      avatar
    }
  }
}

export type TPagedComments = {
  entries: TComment[]
} & TPagi

export type TArticleFilter = {
  order?: TArticleOrder
  cat?: TArticleCat
  status?: TArticleStatus
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
} & TPagi

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
  title: string
  body: string
  index: number
}

export type TPagedArticlesParams = {
  page?: number
  size?: number
  community?: string
  communityTag?: string
  cat?: string
  status?: string
  order?: string
}

export type TArticleParams = {
  community: string
  id: string
}
