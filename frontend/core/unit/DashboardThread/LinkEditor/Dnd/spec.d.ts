import type { DndContext } from '@dnd-kit/core'
import type { ComponentProps, ReactNode } from 'react'

export type TLinkDndTarget = {
  columnId?: string
  itemId?: string
  position?: 'before' | 'after'
}

export type TLinkDndColumnBase = {
  id: string
}

export type TLinkDndType = {
  link: string
  column: string
  sortableColumn?: string
}

export type TLinkDndColumnResult<TColumn extends TLinkDndColumnBase, TLink> = {
  column: TColumn
  link: TLink
}

export type TLinkDndController<
  TColumn extends TLinkDndColumnBase,
  TTarget extends TLinkDndTarget,
> = {
  columns: TColumn[]
  findColumnWithLink: (itemId: string) => { column: TColumn } | null
  startDrag: (itemId: string) => void
  startColumnDrag?: (columnId: string) => void
  moveDrag: (target?: TTarget | null) => void
  commitDrag: (target?: TTarget | null) => void
  commitColumnDrag?: (targetColumnId?: string | null) => void
  cancelDrag: () => void
}

export type TLinkDndRenderProps<TColumn extends TLinkDndColumnBase> = {
  activeDragColumnId: string | null
  columns: TColumn[]
  targetDragColumnId: string | null
}

export type TSortableDndContextProps<
  TColumn extends TLinkDndColumnBase,
  TTarget extends TLinkDndTarget,
> = {
  children: (props: TLinkDndRenderProps<TColumn>) => ReactNode
  contextId: string
  controller: TLinkDndController<TColumn, TTarget>
  dndType: TLinkDndType
  announcements: NonNullable<ComponentProps<typeof DndContext>['accessibility']>['announcements']
  measuring: ComponentProps<typeof DndContext>['measuring']
}
