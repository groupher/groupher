import type { FC } from 'react'

import ArrowSVG from '~/icons/ArrowSimple'
import type { TDocPublicTreeGroup } from '~/spec'

import Item from './Item'
import useSalon from './salon/group'

type TProps = {
  collapsedGroupIds: ReadonlySet<string>
  group: TDocPublicTreeGroup
  forceOpen?: boolean
  onToggle: (groupId: string) => void
}

const Group: FC<TProps> = ({ collapsedGroupIds, group, forceOpen = false, onToggle }) => {
  const collapsed = collapsedGroupIds.has(group.id)
  const displayOpen = forceOpen || !collapsed
  const s = useSalon({ open: displayOpen })

  const pages = group.pages ?? []

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
        {pages.map((item) =>
          String(item.type).toLowerCase() === 'group' ? (
            <Group
              key={item.id}
              collapsedGroupIds={collapsedGroupIds}
              forceOpen={forceOpen}
              group={item as TDocPublicTreeGroup}
              onToggle={onToggle}
            />
          ) : (
            <Item key={item.id} item={item} />
          ),
        )}
      </div>
    </section>
  )
}

export default Group
