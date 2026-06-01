import type { TPagedComments, TCommentsState, TComment } from '~/spec'

import type { MODE } from './constant'

export type TMode = `${MODE}`
export type TAPIMode = 'article' | 'user_published'

export type TInit = Partial<
  Pick<
    TStore,
    | 'mode'
    | 'apiMode'
    | 'pagedComments'
    | 'pagedPublishedComments'
    | 'repliesParentId'
    | 'repliesLoading'
    | 'repliesLoadingByParentId'
    | 'loading'
    | 'needRefreshState'
    | 'isViewerJoined'
    | 'participantsCount'
    | 'totalCount'
    | 'participants'
    | 'initialized'
    | 'showEditor'
    | 'showUpdateEditor'
    | 'showReplyEditor'
    | 'commentBody'
    | 'updateId'
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

  pagedComments: TPagedComments
  pagedPublishedComments: TPagedComments

  repliesParentId: string | null
  repliesLoading: boolean
  repliesLoadingByParentId: Record<string, boolean>
  loading: boolean
  needRefreshState: boolean

  isViewerJoined: TCommentsState['isViewerJoined']
  participantsCount: TCommentsState['participantsCount']
  totalCount: TCommentsState['totalCount']
  participants: TCommentsState['participants']

  initialized: boolean

  showEditor: boolean
  showUpdateEditor: boolean
  showReplyEditor: boolean

  commentBody: string
  updateId: string | null
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
