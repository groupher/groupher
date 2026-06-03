import { useMemo } from 'react'

import useSortableDraft from '../../../../LinkEditor/Dnd/useSortableDraft'
import {
  findGroupWithItem,
  flattenFaqGroups,
  moveFaqGroup,
  moveFaqItemInGroups,
  sameFaqGroups,
} from '../model'
import type { TFaqDragTarget, TFaqEditorGroup, TFaqEditorItem } from '../spec'

type TProps = {
  groups: readonly TFaqEditorGroup[]
  onCommit: (groups: readonly TFaqEditorGroup[]) => void
}

export default function useDocFaqDnd({ groups, onCommit }: TProps) {
  const sourceGroups = useMemo(() => [...groups], [groups])

  return useSortableDraft<TFaqEditorGroup, TFaqEditorItem, TFaqDragTarget, TFaqEditorGroup>({
    sourceColumns: sourceGroups,
    findColumnWithLink: findGroupWithItem,
    flattenColumns: flattenFaqGroups,
    moveLinkInColumns: moveFaqItemInGroups,
    moveColumn: moveFaqGroup,
    sameLinks: sameFaqGroups,
    onCommit,
  })
}
