import { type ReactNode, memo } from 'react'

import SortableGroup from '../../../LinkEditor/Dnd/SortableGroup'
import { FAQ_DND_TYPE } from './constant'

type TProps = {
  children: ReactNode
  className: string
  columnId: string
  disabled?: boolean
  ids: string[]
  overClassName: string
}

const SortableFaqGroup = memo(function SortableFaqGroup({
  children,
  className,
  columnId,
  disabled = false,
  ids,
  overClassName,
}: TProps) {
  return (
    <SortableGroup
      className={className}
      columnId={columnId}
      disabled={disabled}
      dndType={{ link: FAQ_DND_TYPE.ITEM, column: FAQ_DND_TYPE.GROUP }}
      idPrefix='doc-faq-group'
      ids={ids}
      overClassName={overClassName}
    >
      {children}
    </SortableGroup>
  )
})

export default SortableFaqGroup
