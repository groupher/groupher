import { useState } from 'react'

import { TOP_GLOW_KEYS } from '~/const/top_glow'
import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'
import CloseSVG from '~/icons/CloseLight'

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
  const { theme } = useTheme()
  const { t } = useTrans()
  const [expanded, setExpanded] = useState(false)

  const glowType = selectedTokens[theme].glowType
  const otherTheme = theme === 'dark' ? 'light' : 'dark'
  const otherGlowType = selectedTokens[otherTheme].glowType
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
    const overwrite: TThemePresetOverwrite = { [theme]: { glowType: effect } }

    if (effect && !glowType && !otherGlowType) {
      overwrite[otherTheme] = { glowType: effect }
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
            {hiddenCount} {t('dsb.appearance.theme.more')}
          </button>
        )}
      </div>

      {expanded && (
        <div className={s.dividerRow}>
          <div className={s.toggleMask} aria-hidden>
            {t('dsb.appearance.theme.show_less')}
          </div>
          <button
            type='button'
            className={s.toggleFloating}
            aria-expanded={expanded}
            onClick={() => setExpanded(false)}
          >
            <span className={s.toggleText}>{t('dsb.appearance.theme.show_less')}</span>
          </button>
        </div>
      )}
    </div>
  )
}
