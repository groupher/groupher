import type { TComment } from '~/spec'

import type { MODE } from './constant'

export type TMode = `${MODE}`
export type TAPIMode = 'article' | 'user_published'

export type TInit = Partial<
  Pick<
    TStore,
    | 'mode'
    | 'apiMode'
    | 'page'
    | 'repliesParentId'
    | 'repliesLoading'
    | 'repliesLoadingByParentId'
    | 'showEditor'
    | 'showUpdateEditor'
    | 'showReplyEditor'
    | 'commentBody'
    | 'updateInnerId'
    | 'updateBody'
    | 'replyToComment'
    | 'replyBody'
    | 'wordsCountReady'
    | 'publishing'
    | 'publishDone'
    | 'foldedCommentIds'
  >
>

export type TStore = {
  mode: TMode
  apiMode: TAPIMode
  page: number

  repliesParentId: string | null
  repliesLoading: boolean
  repliesLoadingByParentId: Record<string, boolean>
  showEditor: boolean
  showUpdateEditor: boolean
  showReplyEditor: boolean

  commentBody: string
  updateInnerId: string | null
  updateBody: string
  replyToComment: TComment | null
  replyBody: string
  wordsCountReady: boolean

  publishing: boolean
  publishDone: boolean

  foldedCommentIds: string[]

  commit: (patch: Partial<TStore>) => void
  reset: () => void
}
