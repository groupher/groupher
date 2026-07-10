import type { FC } from 'react'

import ArrowSVG from '~/icons/ArrowSimple'
import type { TDocPublicTreeGroup } from '~/spec'

import Item from './Item'
import useSalon from './salon/group'

type TProps = {
  collapsed: boolean
  group: TDocPublicTreeGroup
  forceOpen?: boolean
  onToggle: (groupId: string) => void
}

const Group: FC<TProps> = ({ collapsed, group, forceOpen = false, onToggle }) => {
  const displayOpen = forceOpen || !collapsed
  const s = useSalon({ open: displayOpen })

  const children = group.children ?? []

  return (
    <section className={s.wrapper}>
      <button
        type='button'
        className={s.header}
        aria-expanded={displayOpen}
        onClick={() => onToggle(group.id)}
      >
        <span className={s.title}>{group.title || 'Untitled'}</span>
        <ArrowSVG className={s.arrow} />
      </button>

      <div className={s.children}>
        {children.map((item) => (
          <Item key={item.id} item={item} />
        ))}
      </div>
    </section>
  )
}

export default Group
