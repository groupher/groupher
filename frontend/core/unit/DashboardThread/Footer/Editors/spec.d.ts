import type { TLinkChild } from '~/spec'

export type TFooterDraftLink = TLinkChild & {
  dndId: string
}

export type TFooterColumn = {
  id: string
  title: string
  sourceIndex: number
  links: TFooterDraftLink[]
}

export type TFooterDragTarget = {
  columnId?: string
  itemId?: string
  position?: 'before' | 'after'
}
