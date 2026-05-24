import { AnimatePresence, domAnimation, LazyMotion, m } from 'motion/react'
import { useState } from 'react'

import { SAVING_BAR_LAYOUT_TRANSITION } from '../../../../SavingBar/constant'
import useSalon from '../../salon/details_panel/colors'
import type { TThemeDetails } from '../../spec'
import ColorItem from './ColorItem'
import { MAIN_COLOR_DETAILS, EXTRA_COLOR_DETAILS } from './constant'

type TProps = {
  details: TThemeDetails
}

export default function Colors({ details }: TProps) {
  const s = useSalon()
  const { selectedTokens, onThemePresetCommit } = details
  const [expanded, setExpanded] = useState(false)

  const toggleLabel = expanded ? 'show less' : `${EXTRA_COLOR_DETAILS.length} more`

  return (
    <LazyMotion features={domAnimation}>
      <div className={s.wrapper}>
        {MAIN_COLOR_DETAILS.map((detail) => (
          <ColorItem
            key={detail.key}
            detail={detail}
            selectedTokens={selectedTokens}
            onThemePresetCommit={onThemePresetCommit}
          />
        ))}
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <m.div
            key='more-colors'
            initial={{ height: 0, marginTop: 0, opacity: 0 }}
            animate={{ height: 'auto', marginTop: 32, opacity: 1 }}
            exit={{ height: 0, marginTop: 0, opacity: 0 }}
            transition={SAVING_BAR_LAYOUT_TRANSITION}
            className={s.moreColorsClip}
          >
            <div className={s.moreColors}>
              {EXTRA_COLOR_DETAILS.map((detail) => (
                <ColorItem
                  key={detail.key}
                  detail={detail}
                  selectedTokens={selectedTokens}
                  onThemePresetCommit={onThemePresetCommit}
                />
              ))}
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <div className={s.dividerRow}>
        <div className={s.toggleMask} aria-hidden>
          {toggleLabel}
        </div>
        <button
          type='button'
          className={s.toggle}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          <span className={s.toggleText}>{toggleLabel}</span>
        </button>
      </div>
    </LazyMotion>
  )
}
