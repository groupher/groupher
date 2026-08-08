import { m } from 'motion/react'

import { cn } from '~/css'
import SidebarIcon from '~/icons/dsb/Sidebar'
import { Link } from '~/platform'
import type { TDocPublicTreeGroup } from '~/spec'

import { getNodeHref, isExternalHref } from '../Tree/helper'
import { TREE_TOC_LABEL, TREE_TOC_MOTION } from './constant'
import { groupTreeTocItems } from './helper'
import useSalon from './salon/dash_list'
import type { TTreeTocSelectHandler } from './spec'

type TProps = {
  activeId: string | null
  groups: readonly TDocPublicTreeGroup[]
  onOpenTree: () => void
  onSelect: TTreeTocSelectHandler
}

export default function DashList({ activeId, groups, onOpenTree, onSelect }: TProps) {
  const s = useSalon()
  const groupedItems = groupTreeTocItems(groups)

  return (
    <m.div className={s.wrapper} {...TREE_TOC_MOTION.dash}>
      <button
        type='button'
        className={s.openButton}
        aria-label={TREE_TOC_LABEL.openTree}
        title={TREE_TOC_LABEL.openTree}
        onClick={onOpenTree}
      >
        <SidebarIcon className={s.openIcon} />
      </button>

      <div className={s.groupList}>
        {groupedItems.map(([group, items]) => (
          <div key={group.id} className={s.group}>
            <span className={s.groupItem} aria-label={group.title || 'Untitled'} />

            {items.map((item) => {
              const active = item.id === activeId
              const href = getNodeHref(item)
              const external = isExternalHref(href)
              const className = cn(s.item, active ? s.active : s.idle)

              if (external) {
                return (
                  <a
                    key={item.id}
                    className={className}
                    href={href}
                    target='_blank'
                    rel='noreferrer'
                    aria-label={item.title || 'Untitled'}
                    aria-current={active ? 'location' : undefined}
                    onClick={() => onSelect(item)}
                  />
                )
              }

              return (
                <Link
                  key={item.id}
                  className={className}
                  href={href}
                  aria-label={item.title || 'Untitled'}
                  aria-current={active ? 'location' : undefined}
                  onClick={() => onSelect(item)}
                />
              )
            })}
          </div>
        ))}
      </div>
    </m.div>
  )
}
