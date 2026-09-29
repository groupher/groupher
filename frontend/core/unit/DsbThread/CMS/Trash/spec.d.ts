import type { TArticle, TArticleStats, TPagi, TUser } from '~/spec'

export type TTrashedPost = {
  id: string
  thread: 'POST'
  articleRef: string
  article: TArticle | null
  stats: TArticleStats | null
  deletedBy: TUser | null
  deletedAt: string
  scheduledPermanentDeletionAt: string
  mentionedByCount: number
}

export type TPagedTrashedPosts = TPagi & {
  entries: TTrashedPost[]
}

export type TTrashedPostsData = {
  trashedArticles: TRawPagedTrashedPosts
}

export type TRawTrashedPost = Omit<TTrashedPost, 'article' | 'stats'> & {
  article: (TArticle & { articleStats?: TArticleStats | null }) | null
}

export type TRawPagedTrashedPosts = Omit<TPagedTrashedPosts, 'entries'> & {
  entries: TRawTrashedPost[]
}

export type TRestoreTrashedPostData = {
  restoreTrashedArticle: {
    innerId?: string
    title?: string
  } | null
}

export type TPermanentlyDeleteTrashedPostData = {
  permanentlyDeleteTrashedArticle: {
    done?: boolean
  } | null
}
