import type { TTag, TThread } from '~/spec'

export type TDraftGroup = {
  id: string
  title: string
  thread: TThread
}

export type TGroupListItem = {
  key: string
  title: string
  tags: readonly TTag[]
  draft: boolean
  draftId?: string
}
