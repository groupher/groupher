import { keys } from 'ramda'
import { type CSSProperties, useMemo, useState } from 'react'

import { WALLPAPER_PATTERN } from '~/const/wallpaper'
import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'
import type { TWallpaperData, TWallpaperPattern } from '~/spec'

import { isGradientWallpaper } from '../helper'
import useSalon, { cnMerge } from './salon/pattern_cards'

type TProps = {
  patternId: string
  wallpaper: TWallpaperData
  onPatternSelect: (patternId: string) => void
}

const COLLAPSED_ROWS = 2
const PATTERN_COLUMNS = 7
const COLLAPSED_OPTION_COUNT = PATTERN_COLUMNS * COLLAPSED_ROWS

const getVisiblePatternKeys = (
  patternKeys: string[],
  patternId: string,
  expanded: boolean,
): string[] => {
  if (expanded || patternKeys.length <= COLLAPSED_OPTION_COUNT) return patternKeys

  const visibleSlots = COLLAPSED_OPTION_COUNT - 1
  const visibleKeys = patternKeys.slice(0, visibleSlots)

  if (!patternId || visibleKeys.includes(patternId) || !patternKeys.includes(patternId)) {
    return visibleKeys
  }

  return [...visibleKeys.slice(0, visibleSlots - 1), patternId]
}

export default function PatternCards({ patternId, wallpaper, onPatternSelect }: TProps) {
  const s = useSalon()
  const { t } = useTrans()
  const { isDarkTheme } = useTheme()
  const [expanded, setExpanded] = useState(false)

  const patternKeys = useMemo(() => keys(WALLPAPER_PATTERN), [])
  const visiblePatternKeys = getVisiblePatternKeys(patternKeys, patternId, expanded)
  const hiddenCount = expanded ? 0 : patternKeys.length - visiblePatternKeys.length
  const collapseLabel = t('tags.fold.collapse')
  const canSelectPattern = isGradientWallpaper(wallpaper)

  return (
    <div className={s.wrapper}>
      <div className={s.title}>{t('dsb.appearance.wallpaper.editor.pattern_desc')}</div>
      <div className={s.grid}>
        {visiblePatternKeys.map((id) => {
          const pattern = WALLPAPER_PATTERN[id] as TWallpaperPattern
          const selected = canSelectPattern && patternId === id
          const previewStyle: CSSProperties = {
            backgroundColor: isDarkTheme ? '#ffffff' : '#000000',
            maskImage: `url(${pattern.preview})`,
            maskRepeat: 'repeat',
            maskSize: '300%',
            WebkitMaskImage: `url(${pattern.preview})`,
            WebkitMaskRepeat: 'repeat',
            WebkitMaskSize: '300%',
          }

          return (
            <button
              type='button'
              key={id}
              className={cnMerge(
                s.card,
                selected && s.cardActive,
                !canSelectPattern && s.cardDisabled,
              )}
              aria-label={`Pattern ${id}`}
              aria-pressed={selected}
              disabled={!canSelectPattern}
              onClick={() => onPatternSelect(id)}
            >
              <span className={s.preview} style={previewStyle} />
            </button>
          )
        })}

        {hiddenCount > 0 && (
          <div className={s.toggleSlot}>
            <button
              type='button'
              className={s.toggle}
              aria-expanded={expanded}
              onClick={() => setExpanded(true)}
            >
              {t('more')}
            </button>
          </div>
        )}
      </div>
      <br />

      {expanded && (
        <div className={s.dividerRow}>
          <div className={s.toggleMask} aria-hidden>
            {collapseLabel}
          </div>
          <button
            type='button'
            className={s.toggleFloating}
            aria-expanded={expanded}
            onClick={() => setExpanded(false)}
          >
            <span className={s.toggleText}>{collapseLabel}</span>
          </button>
        </div>
      )}
    </div>
  )
}
