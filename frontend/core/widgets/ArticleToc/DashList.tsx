import { m } from 'motion/react'

import { cn } from '~/css'

import { ARTICLE_TOC_MOTION } from './constant'
import useSalon from './salon/dash_list'
import type { TArticleTocItem, TArticleTocSelectHandler } from './spec'

type TProps = {
  items: readonly TArticleTocItem[]
  activeId: string | null
  onSelect: TArticleTocSelectHandler
}

export default function DashList({ items, activeId, onSelect }: TProps) {
  const s = useSalon()

  return (
    <m.div className={s.wrapper} {...ARTICLE_TOC_MOTION.dash}>
      {items.map((item) => {
        const active = item.id === activeId

        return (
          <button
            key={item.id}
            type='button'
            className={cn(
              s.item,
              active ? s.active : cn(item.level === 2 ? s.level2 : s.level3, s.idle),
            )}
            aria-label={item.title}
            aria-current={active ? 'location' : undefined}
            onClick={() => onSelect(item)}
          />
        )
      })}
    </m.div>
  )
}
