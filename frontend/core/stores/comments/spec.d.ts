import type { TComment } from '~/spec'

import type { MODE } from './constant'

export type TMode = `${MODE}`
export type TAPIMode = 'article' | 'user_published'

export type TInit = Partial<
  Pick<
    TStore,
    | 'mode'
    | 'apiMode'
    | 'showEditor'
    | 'showUpdateEditor'
    | 'showReplyEditor'
    | 'commentBody'
    | 'updateInnerId'
    | 'updateBody'
    | 'updateBodyVersion'
    | 'replyToComment'
    | 'replyBody'
    | 'wordsCountReady'
    | 'publishing'
    | 'publishDone'
    | 'foldedCommentIds'
    | 'expandedCommentIds'
  >
>

export type TStore = {
  mode: TMode
  apiMode: TAPIMode

  showEditor: boolean
  showUpdateEditor: boolean
  showReplyEditor: boolean

  commentBody: string
  updateInnerId: string | null
  updateBody: string
  updateBodyVersion: number | null
  replyToComment: TComment | null
  replyBody: string
  wordsCountReady: boolean

  publishing: boolean
  publishDone: boolean

  expandedCommentIds: string[]
  foldedCommentIds: string[]

  commit: (patch: Partial<TStore>) => void
  reset: () => void
}
