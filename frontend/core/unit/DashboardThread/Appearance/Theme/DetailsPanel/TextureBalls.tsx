import { useState } from 'react'

import { TOP_GLOW_KEYS } from '~/const/top_glow'
import useThemeKV from '~/hooks/useThemeKV'
import CloseSVG from '~/icons/CloseLight'

import { PRESET_FIELD } from '../constant'
import type { TThemePresetOverwrite, TThemePresetTokens } from '../spec'
import useSalon, { cn, cnMerge } from './salon/texture_balls'

type TProps = {
  selectedTokens: TThemePresetTokens
  onThemePresetCommit: (overwrite: TThemePresetOverwrite) => void
  rowClassName?: string
}

const COLLAPSED_OPTION_COUNT = 7

export default function TextureBalls({
  selectedTokens,
  onThemePresetCommit,
  rowClassName,
}: TProps) {
  const s = useSalon()
  const { section, value, patch } = useThemeKV()
  const [expanded, setExpanded] = useState(false)

  const glowType = value(selectedTokens, PRESET_FIELD.GLOW_TYPE)
  const otherSection = section === 'light' ? 'dark' : 'light'
  const otherGlowType = selectedTokens[otherSection].glowType
  const allOptions = ['', ...TOP_GLOW_KEYS]
  const activeHidden =
    !!glowType && allOptions.slice(COLLAPSED_OPTION_COUNT).includes(glowType as string)

  const visibleOptions = expanded
    ? allOptions
    : activeHidden
      ? [...allOptions.slice(0, COLLAPSED_OPTION_COUNT - 1), glowType as string]
      : allOptions.slice(0, COLLAPSED_OPTION_COUNT)

  const hiddenCount = allOptions.length - visibleOptions.length

  const commitGlowType = (effect: string) => {
    const overwrite: TThemePresetOverwrite = patch({ glowType: effect })

    if (effect && !glowType && !otherGlowType) {
      overwrite[otherSection] = { glowType: effect }
    }

    onThemePresetCommit(overwrite)
  }

  return (
    <div className={s.wrapper}>
      <div className={cnMerge(s.row, rowClassName)}>
        {visibleOptions.map((effect) => (
          <button
            key={effect || 'none'}
            type='button'
            className={cn(s.block, effect === glowType && s.blockActive)}
            aria-pressed={effect === glowType}
            onClick={() => commitGlowType(effect)}
          >
            {effect ? (
              <div className={s.textureBall} style={s.textureStyle()}>
                <div className={s.glowLayer} style={{ background: `${s.glowStyle(effect)}` }} />
              </div>
            ) : (
              <CloseSVG className={cn(s.icon, 'opacity-60')} />
            )}
          </button>
        ))}

        {hiddenCount > 0 && (
          <button
            type='button'
            className={s.toggle}
            aria-expanded={expanded}
            onClick={() => setExpanded(true)}
          >
            {hiddenCount} more
          </button>
        )}
      </div>

      {expanded && (
        <div className={s.dividerRow}>
          <div className={s.toggleMask} aria-hidden>
            show less
          </div>
          <button
            type='button'
            className={s.toggleFloating}
            aria-expanded={expanded}
            onClick={() => setExpanded(false)}
          >
            <span className={s.toggleText}>show less</span>
          </button>
        </div>
      )}
    </div>
  )
}
