import { memo, type ReactNode } from 'react'

import SortableItem from '../../LinkEditor/Dnd/SortableItem'
import { HEADER_DND_TYPE } from './constants'

type TProps = {
  children: ReactNode
  columnId: string
  disabled?: boolean
  editing?: boolean
  id: string
  linkId: string
}

const SortableHeaderLinkItem = memo(function SortableHeaderLinkItem({
  children,
  columnId,
  disabled = false,
  editing = false,
  id,
  linkId,
}: TProps) {
  return (
    <SortableItem
      ariaLabel='Drag header link'
      columnId={columnId}
      data={{ linkId }}
      disabled={disabled}
      dndType={{ link: HEADER_DND_TYPE.LINK, column: HEADER_DND_TYPE.COLUMN }}
      editing={editing}
      id={id}
    >
      {children}
    </SortableItem>
  )
})

export default SortableHeaderLinkItem
