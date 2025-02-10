import type { TID, TTag, TEditMode, TUser, TArticleCat, TSubmitState, TGroupedTags } from '~/spec'

export type TStore = {
  mode: TEditMode
  isArchived: boolean
  archivedAt: string | null

  title: string
  author: TUser | null
  body: string
  linkAddr: string
  copyRight: string
  isQuestion: boolean

  articleTags: TTag[]
  // job spec
  company: string
  companyLink: string

  // showSubTitle: T.opt(T.bool, false),
  publishing: boolean
  publishDone: boolean
  //
  wordsCountReady: boolean

  // selectors
  activeCat: TArticleCat
  activeTag: TTag

  // drived
  allowEdit: boolean
  isArticleAuthor: boolean
  isReady: boolean
  submitState: TSubmitState

  commit: (patch: Partial<TStore>) => void
}

export type TTexts = {
  holder: {
    title: string
    body: string
  }
}

export type TEditData = {
  title: string
  body: string
  copyRight: string
  isQuestion?: boolean
  linkAddr?: string

  company?: string
  companyLink?: string

  articleTags: [TID]
}
