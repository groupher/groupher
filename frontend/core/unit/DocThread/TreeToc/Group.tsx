import type { FC } from 'react'

import type { TDocPublicTreeGroup } from '~/spec'

import Item from './Item'
import useSalon from './salon/group'
import type { TTreeTocItem, TTreeTocSelectHandler } from './spec'

type TProps = {
  group: TDocPublicTreeGroup
  items: readonly TTreeTocItem[]
  onSelect: TTreeTocSelectHandler
}

const Group: FC<TProps> = ({ group, items, onSelect }) => {
  const s = useSalon()

  if (items.length === 0) return null

  return (
    <section className={s.wrapper}>
      <div className={s.title}>{group.title || 'Untitled'}</div>
      <div className={s.children}>
        {items.map((item) => (
          <Item key={item.id} item={item} onSelect={onSelect} />
        ))}
      </div>
    </section>
  )
}

export default Group
