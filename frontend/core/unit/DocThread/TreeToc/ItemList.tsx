import { m } from 'motion/react'

import SidebarIcon from '~/icons/dsb/Sidebar'
import type { TDocPublicTreeGroup } from '~/spec'

import { TREE_TOC_LABEL, TREE_TOC_MOTION } from './constant'
import Group from './Group'
import { groupTreeTocItems } from './helper'
import useSalon from './salon/item_list'
import type { TTreeTocSelectHandler } from './spec'

type TProps = {
  groups: readonly TDocPublicTreeGroup[]
  onOpenTree: () => void
  onSelect: TTreeTocSelectHandler
}

export default function ItemList({ groups, onOpenTree, onSelect }: TProps) {
  const s = useSalon()
  const groupedItems = groupTreeTocItems(groups)
  const hasItems = groupedItems.some(([, items]) => items.length > 0)

  return (
    <m.div className={s.wrapper} {...TREE_TOC_MOTION.tree}>
      <div className={s.header}>
        <button
          type='button'
          className={s.openButton}
          aria-label={TREE_TOC_LABEL.openTree}
          title={TREE_TOC_LABEL.openTree}
          onClick={onOpenTree}
        >
          <SidebarIcon className={s.openIcon} />
        </button>
      </div>

      {hasItems ? (
        <div className={s.list}>
          {groupedItems.map(([group, items]) => (
            <Group key={group.id} group={group} items={items} onSelect={onSelect} />
          ))}
        </div>
      ) : (
        <div className={s.empty}>No docs</div>
      )}
    </m.div>
  )
}
