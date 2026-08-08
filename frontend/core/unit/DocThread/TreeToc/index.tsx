import { AnimatePresence, domAnimation, LazyMotion } from 'motion/react'
import { useMemo, useState } from 'react'

import { usePathname } from '~/platform'
import type { TDocPublicTreeGroup } from '~/spec'

import { isActiveHref } from '../Tree/helper'
import { TREE_TOC_LABEL, TREE_TOC_MODE } from './constant'
import DashList from './DashList'
import { flattenTreeTocItems } from './helper'
import ItemList from './ItemList'
import useSalon from './salon'
import type { TTreeTocItem } from './spec'

type TProps = {
  groups: readonly TDocPublicTreeGroup[]
  onOpenTree: () => void
}

export default function TreeToc({ groups, onOpenTree }: TProps) {
  const [hovered, setHovered] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const pathname = usePathname()
  const s = useSalon()
  const items = useMemo(() => flattenTreeTocItems(groups), [groups])
  const activeItem = items.find((item) => isActiveHref(pathname, item.href))
  const activeId = activeItem?.id ?? selectedId
  const mode = hovered ? TREE_TOC_MODE.TREE : TREE_TOC_MODE.DASH

  const handleSelect = (item: TTreeTocItem): void => setSelectedId(item.id)

  return (
    <nav
      className={s.wrapper}
      aria-label={TREE_TOC_LABEL.nav}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <LazyMotion features={domAnimation}>
        <AnimatePresence initial={false} mode='wait'>
          {mode === TREE_TOC_MODE.TREE ? (
            <ItemList
              key={TREE_TOC_MODE.TREE}
              groups={groups}
              onOpenTree={onOpenTree}
              onSelect={handleSelect}
            />
          ) : (
            <DashList
              key={TREE_TOC_MODE.DASH}
              groups={groups}
              activeId={activeId}
              onOpenTree={onOpenTree}
              onSelect={handleSelect}
            />
          )}
        </AnimatePresence>
      </LazyMotion>
    </nav>
  )
}
