import { AnimatePresence, domAnimation, LazyMotion } from 'motion/react'
import { useState } from 'react'

import { cnMerge } from '~/css'

import { ARTICLE_TOC_LABEL, ARTICLE_TOC_MODE } from './constant'
import DashList from './DashList'
import HeaderList from './HeaderList'
import useSalon from './salon'
import type { TArticleTocItem, TArticleTocSelectHandler } from './spec'

export type { TArticleTocItem } from './spec'

export type TArticleTocProps = {
  items: readonly TArticleTocItem[]
  activeId: string | null
  onSelect: TArticleTocSelectHandler
  pinned?: boolean
  defaultPinned?: boolean
  ariaLabel?: string
  className?: string
  onPinnedChange?: (pinned: boolean) => void
}

export default function ArticleToc({
  items,
  activeId,
  onSelect,
  pinned,
  defaultPinned = false,
  ariaLabel = ARTICLE_TOC_LABEL.nav,
  className = '',
  onPinnedChange,
}: TArticleTocProps) {
  const [innerPinned, setInnerPinned] = useState(defaultPinned)
  const [hovered, setHovered] = useState(false)
  const s = useSalon()
  const pinnedActive = pinned ?? innerPinned
  const mode = pinnedActive || hovered ? ARTICLE_TOC_MODE.HEADERS : ARTICLE_TOC_MODE.DASH

  const handleTogglePin = (): void => {
    const nextPinned = !pinnedActive

    if (pinned === undefined) {
      setInnerPinned(nextPinned)
    }

    onPinnedChange?.(nextPinned)
  }

  if (items.length === 0) return null

  return (
    <nav
      className={cnMerge(s.wrapper, className)}
      aria-label={ariaLabel}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <LazyMotion features={domAnimation}>
        <AnimatePresence initial={false} mode='wait'>
          {mode === ARTICLE_TOC_MODE.HEADERS ? (
            <HeaderList
              key={ARTICLE_TOC_MODE.HEADERS}
              items={items}
              activeId={activeId}
              pinned={pinnedActive}
              onSelect={onSelect}
              onTogglePin={handleTogglePin}
            />
          ) : (
            <DashList
              key={ARTICLE_TOC_MODE.DASH}
              items={items}
              activeId={activeId}
              onSelect={onSelect}
            />
          )}
        </AnimatePresence>
      </LazyMotion>
    </nav>
  )
}
