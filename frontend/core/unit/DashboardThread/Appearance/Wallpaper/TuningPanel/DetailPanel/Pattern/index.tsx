import { WALLPAPER_PATTERN_TONE } from '~/const/wallpaper'
import useTrans from '~/hooks/useTrans'
import type { TWallpaperPatternTone } from '~/spec'
import PatternIntensityField from '~/widgets/TuningFields/PatternIntensityField'
import ToggleField from '~/widgets/TuningFields/ToggleField'

import useSalon from '../../salon/detail_panel/pattern'
import GroupTitle from '../GroupTitle'

type Props = {
  hasPattern: boolean
  patternTone: TWallpaperPatternTone
  patternIntensity: number
  onTogglePattern: (hasPattern: boolean) => void
  onPatternToneChange: (lightPattern: boolean) => void
  onPatternIntensityChange: (value: number) => void
  onRangeChangeEnd: () => void
}

export default function Pattern({
  hasPattern,
  patternTone,
  patternIntensity,
  onTogglePattern,
  onPatternToneChange,
  onPatternIntensityChange,
  onRangeChangeEnd,
}: Props) {
  const { t } = useTrans()
  const s = useSalon()

  return (
    <section className={s.wrapper}>
      <GroupTitle>{t('dsb.appearance.wallpaper.editor.pattern')}</GroupTitle>

      <div className={s.items}>
        <ToggleField
          label={t('dsb.appearance.wallpaper.editor.enable')}
          checked={hasPattern}
          onChange={onTogglePattern}
        />

        {hasPattern && (
          <>
            <ToggleField
              label={t('dsb.appearance.wallpaper.editor.invert_tone')}
              checked={patternTone === WALLPAPER_PATTERN_TONE.LIGHT}
              onChange={onPatternToneChange}
            />

            <PatternIntensityField
              value={patternIntensity}
              onChange={onPatternIntensityChange}
              onChangeEnd={onRangeChangeEnd}
            />
          </>
        )}
      </div>
    </section>
  )
}
