import { m } from 'motion/react'

import { cn } from '~/css'
import PinIcon from '~/icons/Pin'

import { ARTICLE_TOC_LABEL, ARTICLE_TOC_MOTION } from './constant'
import useSalon from './salon/header_list'
import type { TArticleTocItem, TArticleTocSelectHandler } from './spec'

type TProps = {
  items: readonly TArticleTocItem[]
  activeId: string | null
  pinned: boolean
  onSelect: TArticleTocSelectHandler
  onTogglePin: () => void
}

export default function HeaderList({ items, activeId, pinned, onSelect, onTogglePin }: TProps) {
  const s = useSalon()

  return (
    <m.div className={s.wrapper} {...ARTICLE_TOC_MOTION.headers}>
      <button
        type='button'
        className={cn(s.pinButton, pinned ? s.pinButtonPinned : s.pinButtonIdle)}
        aria-pressed={pinned}
        aria-label={pinned ? ARTICLE_TOC_LABEL.unpin : ARTICLE_TOC_LABEL.pin}
        onClick={onTogglePin}
      >
        <PinIcon className={s.pinIcon} />
      </button>

      <div className={s.inner}>
        {items.map((item) => {
          const active = item.id === activeId

          return (
            <button
              key={item.id}
              type='button'
              className={cn(
                s.item,
                item.level === 3 ? s.indent : s.flush,
                active ? s.active : s.idle,
              )}
              aria-current={active ? 'location' : undefined}
              onClick={() => onSelect(item)}
            >
              <span className={s.title}>{item.title}</span>
            </button>
          )
        })}
      </div>
    </m.div>
  )
}
