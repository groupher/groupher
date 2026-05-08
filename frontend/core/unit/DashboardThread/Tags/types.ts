import type { TTag, TThread } from '~/spec'

export type TDraftGroup = {
  id: string
  title: string
  thread: TThread
}

export type TGroupListItem = {
  key: string
  title: string
  group?: string | null
  tags: readonly TTag[]
  draft: boolean
  draftId?: string
}

export type TTagDropPosition = 'before' | 'after'

export type TTagDragTarget = {
  tagId?: string
  groupKey?: string
  position?: TTagDropPosition
}
