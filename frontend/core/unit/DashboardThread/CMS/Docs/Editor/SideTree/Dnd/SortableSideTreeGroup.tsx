import { type ReactNode, memo } from 'react'

import SortableGroup from '../../../../../LinkEditor/Dnd/SortableGroup'
import { SIDE_TREE_DND_TYPE } from './constant'

type TProps = {
  children: ReactNode
  className: string
  columnId: string
  disabled?: boolean
  ids: string[]
}

const SortableSideTreeGroup = memo(function SortableSideTreeGroup({
  children,
  className,
  columnId,
  disabled = false,
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
      overClassName=''
    >
      {children}
    </SortableGroup>
  )
})

export default SortableSideTreeGroup
