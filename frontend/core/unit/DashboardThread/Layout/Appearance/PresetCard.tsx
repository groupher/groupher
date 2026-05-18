import THEME from '~/const/theme'
import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'
import { getPageBgCustomColor } from '~/lib/color'
import type { TTransKey } from '~/spec'
import Checker from '~/widgets/Checker'

import useSalon from '../../salon/layout/preset_card'
import MiniBars from './MiniBars'
import type { TThemePresetOption } from './spec'

type TProps = {
  preset: TThemePresetOption
  active: boolean
  activeSuppressed: boolean
  rotateAngle: number
  onHover: (preset: string | null) => void
  onSelect: (preset: TThemePresetOption) => void
}

export default function PresetCard({
  preset,
  active,
  activeSuppressed,
  rotateAngle,
  onHover,
  onSelect,
}: TProps) {
  const s = useSalon({ active, activeSuppressed, rotateAngle })
  const { t } = useTrans()
  const { isLightTheme } = useTheme()
  const presetKey = preset.value.toLowerCase()
  const presetPrimaryCustomColor = isLightTheme
    ? preset.overrides.primaryCustomColor
    : preset.overrides.primaryCustomColorDark
  const cardBg = getPageBgCustomColor(
    THEME.LIGHT,
    preset.overrides.pageCustomBg,
    preset.overrides.pageCustomIntensity,
  )

  return (
    <div
      role='button'
      tabIndex={0}
      aria-pressed={active}
      className={s.wrapper}
      onPointerEnter={() => onHover(preset.value)}
      onPointerLeave={() => onHover(null)}
      onClick={() => onSelect(preset)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return

        event.preventDefault()
        onSelect(preset)
      }}
    >
      <div className={s.card}>
        <div className={s.preview} style={{ backgroundColor: cardBg }}>
          <MiniBars
            active={active}
            primaryColor={preset.overrides.primaryColor}
            primaryCustomColor={presetPrimaryCustomColor}
            subPrimaryColor={preset.overrides.subPrimaryColor}
            textTitle={preset.overrides.textTitle}
            textDigest={preset.overrides.textDigest}
          />
        </div>

        <div className={s.title}>
          {t(`dsb.layout.appearance.preset.${presetKey}.title` as TTransKey)}
        </div>

        {active && (
          <div className={s.checker}>
            <Checker
              checked
              hiddenMode
              size='small'
              aria-label={t(`dsb.layout.appearance.preset.${presetKey}.title` as TTransKey)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
