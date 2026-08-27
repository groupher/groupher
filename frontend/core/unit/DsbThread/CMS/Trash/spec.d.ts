import type { TArticle, TPagi, TUser } from '~/spec'

export type TTrashedPost = {
  id: string
  thread: 'POST'
  articleRef: string
  article: TArticle | null
  deletedBy: TUser | null
  deletedAt: string
  scheduledPermanentDeletionAt: string
  mentionedByCount: number
}

export type TPagedTrashedPosts = TPagi & {
  entries: TTrashedPost[]
}

export type TTrashedPostsData = {
  trashedArticles: TPagedTrashedPosts
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
