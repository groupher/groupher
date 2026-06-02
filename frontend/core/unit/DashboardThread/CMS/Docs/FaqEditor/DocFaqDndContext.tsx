import type { ReactNode } from 'react'

import SortableDndContext from '../../../LinkEditor/Dnd/SortableDndContext'
import { DND_MEASURING, FAQ_DND_CONTEXT_ID, FAQ_DND_TYPE } from './constant'
import { DND_ANNOUNCEMENTS } from './helper'
import type { TFaqDragTarget, TFaqEditorGroup } from './spec'
import useDocFaqDnd from './useDocFaqDnd'

type TRenderProps = {
  activeDragColumnId: string | null
  columns: TFaqEditorGroup[]
  targetDragColumnId: string | null
  targetDragItemId: string | null
  targetDragPosition: TFaqDragTarget['position'] | null
}

type TProps = {
  children: (props: TRenderProps) => ReactNode
  groups: readonly TFaqEditorGroup[]
  onCommit: (groups: readonly TFaqEditorGroup[]) => void
}

export default function DocFaqDndContext({ children, groups, onCommit }: TProps) {
  const dndController = useDocFaqDnd({ groups, onCommit })

  return (
    <SortableDndContext<TFaqEditorGroup, TFaqDragTarget>
      contextId={FAQ_DND_CONTEXT_ID}
      controller={dndController}
      dndType={{
        link: FAQ_DND_TYPE.ITEM,
        column: FAQ_DND_TYPE.GROUP,
        sortableColumn: FAQ_DND_TYPE.SORTABLE_GROUP,
      }}
      announcements={DND_ANNOUNCEMENTS}
      measuring={DND_MEASURING}
    >
      {children}
    </SortableDndContext>
  )
}
