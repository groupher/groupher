import { type ReactNode, memo } from 'react'

import SortableGroup from '../../LinkEditor/Dnd/SortableGroup'
import { FOOTER_DND_TYPE } from './constants'

type TProps = {
  children: ReactNode
  className: string
  columnId: string
  ids: string[]
  overClassName: string
  targetClassName?: string
}

const FooterSortableGroup = memo(function FooterSortableGroup({
  children,
  className,
  columnId,
  ids,
  overClassName,
  targetClassName = '',
}: TProps) {
  return (
    <SortableGroup
      className={className}
      columnId={columnId}
      dndType={{ link: FOOTER_DND_TYPE.LINK, column: FOOTER_DND_TYPE.COLUMN }}
      idPrefix='footer-column'
      ids={ids}
      overClassName={overClassName}
      targetClassName={targetClassName}
    >
      {children}
    </SortableGroup>
  )
})

export default FooterSortableGroup
