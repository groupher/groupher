import { type ReactNode, memo } from 'react'

import SortableGroup from '../../LinkEditor/Dnd/SortableGroup'
import { HEADER_DND_TYPE } from './constants'

type TProps = {
  children: ReactNode
  className: string
  columnId: string
  ids: string[]
  disabled?: boolean
  overClassName: string
  targetClassName?: string
}

const HeaderSortableGroup = memo(function HeaderSortableGroup({
  children,
  className,
  columnId,
  disabled = false,
  ids,
  overClassName,
  targetClassName = '',
}: TProps) {
  return (
    <SortableGroup
      className={className}
      columnId={columnId}
      disabled={disabled}
      dndType={{ link: HEADER_DND_TYPE.LINK, column: HEADER_DND_TYPE.COLUMN }}
      idPrefix='header-column'
      ids={ids}
      overClassName={overClassName}
      targetClassName={targetClassName}
    >
      {children}
    </SortableGroup>
  )
})

export default HeaderSortableGroup
