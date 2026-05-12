import { memo, type ReactNode } from 'react'

import SortableItem from '../../LinkEditor/Dnd/SortableItem'
import { FOOTER_DND_TYPE } from './constants'

type TProps = {
  children: ReactNode
  columnId: string
  editing?: boolean
  id: string
}

const SortableFooterLinkItem = memo(function SortableFooterLinkItem({
  children,
  columnId,
  editing = false,
  id,
}: TProps) {
  return (
    <SortableItem
      ariaLabel='Drag footer link'
      columnId={columnId}
      dndType={{ link: FOOTER_DND_TYPE.LINK, column: FOOTER_DND_TYPE.COLUMN }}
      editing={editing}
      id={id}
    >
      {children}
    </SortableItem>
  )
})

export default SortableFooterLinkItem
