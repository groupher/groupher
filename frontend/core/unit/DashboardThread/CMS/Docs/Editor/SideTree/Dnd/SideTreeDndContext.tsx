import { type ReactNode } from 'react'

import SortableDndContext from '../../../../../LinkEditor/Dnd/SortableDndContext'
import type { TSideTreeGroup } from '../spec'
import {
  DND_ANNOUNCEMENTS,
  DND_MEASURING,
  SIDE_TREE_DND_CONTEXT_ID,
  SIDE_TREE_DND_TYPE,
} from './constant'
import type { TSideTreeDragTarget } from './spec'
import useSideTreeDnd from './useSideTreeDnd'

type TRenderProps = {
  activeDragColumnId: string | null
  columns: TSideTreeGroup[]
  targetDragColumnId: string | null
  targetDragItemId: string | null
  targetDragPosition: TSideTreeDragTarget['position'] | null
}

type TProps = {
  children: (props: TRenderProps) => ReactNode
  groups: readonly TSideTreeGroup[]
  onCommit: (groups: readonly TSideTreeGroup[]) => void
}

// Thin dnd-kit shell for the docs side tree. The shared context owns sensors
// and collision detection; SideTree-specific code owns tree ordering.
export default function SideTreeDndContext({ children, groups, onCommit }: TProps) {
  const dndController = useSideTreeDnd({ groups, onCommit })

  return (
    <SortableDndContext<TSideTreeGroup, TSideTreeDragTarget>
      contextId={SIDE_TREE_DND_CONTEXT_ID}
      controller={dndController}
      dndType={{
        link: SIDE_TREE_DND_TYPE.CHILD,
        column: SIDE_TREE_DND_TYPE.GROUP,
        sortableColumn: SIDE_TREE_DND_TYPE.SORTABLE_GROUP,
      }}
      announcements={DND_ANNOUNCEMENTS}
      measuring={DND_MEASURING}
    >
      {children}
    </SortableDndContext>
  )
}
