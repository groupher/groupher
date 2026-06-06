import { useMemo } from 'react'

import useSortableDraft from '../../../../../LinkEditor/Dnd/useSortableDraft'
import {
  findGroupWithChild,
  flattenSideTreeGroups,
  moveSideTreeChildInGroups,
  moveSideTreeGroup,
  sameSideTreeGroups,
} from '../model'
import type { TSideTreeChild, TSideTreeGroup } from '../spec'
import type { TSideTreeDragTarget } from './spec'

type TProps = {
  groups: readonly TSideTreeGroup[]
  onCommit: (groups: readonly TSideTreeGroup[]) => void
}

type TRet = {
  columns: TSideTreeGroup[]
  findColumnWithLink: (itemId: string) => ReturnType<typeof findGroupWithChild>
  startDrag: (itemId: string) => void
  startColumnDrag: (groupId: string) => void
  moveDrag: (target?: TSideTreeDragTarget | null) => void
  commitDrag: (target?: TSideTreeDragTarget | null) => void
  commitColumnDrag: (targetGroupId?: string | null) => void
  cancelDrag: () => void
}

// Wires the docs tree model into the shared dashboard dnd draft controller.
// Groups map to columns; page/link children map to sortable links.
export default function useSideTreeDnd({ groups, onCommit }: TProps): TRet {
  const sourceGroups = useMemo(() => [...groups], [groups])

  return useSortableDraft<TSideTreeGroup, TSideTreeChild, TSideTreeDragTarget, TSideTreeGroup>({
    sourceColumns: sourceGroups,
    findColumnWithLink: findGroupWithChild,
    flattenColumns: flattenSideTreeGroups,
    moveLinkInColumns: moveSideTreeChildInGroups,
    moveColumn: moveSideTreeGroup,
    sameLinks: sameSideTreeGroups,
    onCommit,
  })
}
