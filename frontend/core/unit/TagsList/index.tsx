/*
 * TagsList
 */

import type { FC } from 'react'

import SIZE from '~/const/size'
import type { TSizeTSM, TSpace, TTag } from '~/spec'
import Tooltip from '~/widgets/Tooltip'

import FoldList from './FoldList'
import List from './List'
import useSalon from './salon'

export type TProps = {
  items: readonly TTag[]
  max?: number
  size?: TSizeTSM
} & TSpace

const TagsList: FC<TProps> = ({ items, max = 2, size = SIZE.TINY, ...spacing }) => {
  const s = useSalon(spacing)

  if (!items) return null

  if (items.length <= max) {
    return (
      <div className={s.wrapper}>
        <List items={items} size={size} max={max} {...spacing} />
      </div>
    )
  }

  return (
    <div className={s.wrapper}>
      <Tooltip
        placement='bottom'
        content={
          <div className={s.popover}>
            <List items={items} size={size} max={items.length} {...spacing} />
          </div>
        }
      >
        {items.length > 0 && <FoldList items={items} size={size} max={max} {...spacing} />}
      </Tooltip>
    </div>
  )
}

export default TagsList
