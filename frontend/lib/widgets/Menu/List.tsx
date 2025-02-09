import type { FC } from 'react'

import type { TMenuItem } from './spec'
import Item from './Item'
import useSalon from './salon/list'

type TProps = {
  items: TMenuItem[]
  activeKey: string
  onSelect: (item: TMenuItem) => void
  popWidth: number
}

const List: FC<TProps> = ({ items, activeKey, onSelect, popWidth }) => {
  const s = useSalon({ popWidth })

  return (
    <div className={s.wrapper}>
      {items.map((item) => {
        const active = activeKey === item.key

        return <Item key={item.key} item={item} active={active} onClick={() => onSelect(item)} />
      })}
    </div>
  )
}

export default List
