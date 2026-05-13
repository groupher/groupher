import type { TTag, TThread } from '~/spec'

export type TDraftGroup = {
  id: string
  title: string
  thread: TThread
}

export type TGroupListItem = {
  id: string
  title: string
  index: number
  tags: readonly TTag[]
  draft: boolean
  draftId?: string
}

export type TTagDropPosition = 'before' | 'after'

export type TTagDragTarget = {
  tagId?: string
  groupId?: string
  position?: TTagDropPosition
}

export type TGroupDragTarget = {
  groupId: string
  position: TTagDropPosition
}
