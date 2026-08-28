import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'
import CheckedSVG from '~/icons/CheckBold'
import type { TTransKey } from '~/spec'

import MiniBars from '../MiniBars'
import type { TThemePresetCardMode, TThemePresetOption } from '../spec'
import useSalon from './salon/preset_card'

type TProps = {
  preset: TThemePresetOption
  active: boolean
  mode?: TThemePresetCardMode
  rotateAngle: number
  onSelect: (preset: TThemePresetOption) => void
}

export default function PresetCard({
  preset,
  active,
  mode = 'stacked',
  rotateAngle,
  onSelect,
}: TProps) {
  const s = useSalon({
    active,
    mode,
    rotateAngle,
  })
  const { t } = useTrans()
  const { theme } = useTheme()
  const disabled = mode === 'forkBase'
  const presetKey = preset.value.toLowerCase()
  const sectionTokens = preset.tokens[theme]
  const cardBg = sectionTokens.pageBg
  const primaryColor = sectionTokens.primaryColor
  const accentColor = sectionTokens.accentColor
  const textTitle = sectionTokens.textTitle
  const textDigest = sectionTokens.textDigest
  const title = t(`dsb.appearance.theme.preset.${presetKey}.title` as TTransKey)

  return (
    <div
      role='button'
      tabIndex={disabled ? -1 : 0}
      aria-pressed={active}
      aria-disabled={disabled}
      className={s.wrapper}
      onClick={() => {
        if (!disabled) onSelect(preset)
      }}
      onKeyDown={(event) => {
        if (disabled) return
        if (event.key !== 'Enter' && event.key !== ' ') return

        event.preventDefault()
        onSelect(preset)
      }}
    >
      <div className={s.card}>
        {active && (
          <span className={s.activeSign}>
            <CheckedSVG className={s.checkIcon} />
          </span>
        )}

        <div className={s.preview} style={{ backgroundColor: cardBg }}>
          <MiniBars
            active={active}
            primaryColor={primaryColor}
            accentColor={accentColor}
            textTitle={textTitle}
            textDigest={textDigest}
          />
        </div>

        <div className={s.title}>{title}</div>
      </div>
    </div>
  )
}
