import { type ReactNode, type RefCallback, memo } from 'react'

import SortableGroup from '../../../../../LinkEditor/Dnd/SortableGroup'
import { SIDE_TREE_DND_TYPE } from './constant'

type TProps = {
  children: ReactNode
  className: string
  columnId: string
  disabled?: boolean
  ids: string[]
  externalListRef?: RefCallback<HTMLDivElement>
}

const SortableSideTreeGroup = memo(function SortableSideTreeGroup({
  children,
  className,
  columnId,
  disabled = false,
  externalListRef,
  ids,
}: TProps) {
  return (
    <SortableGroup
      className={className}
      columnId={columnId}
      disabled={disabled}
      dndType={{ link: SIDE_TREE_DND_TYPE.CHILD, column: SIDE_TREE_DND_TYPE.GROUP }}
      idPrefix='docs-side-tree-group'
      ids={ids}
      externalListRef={externalListRef}
      overClassName=''
    >
      {children}
    </SortableGroup>
  )
})

export default SortableSideTreeGroup
