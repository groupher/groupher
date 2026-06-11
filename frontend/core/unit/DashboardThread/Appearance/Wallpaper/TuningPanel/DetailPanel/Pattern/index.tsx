import { WALLPAPER_PATTERN_TONE } from '~/const/wallpaper'
import useTrans from '~/hooks/useTrans'
import type { TBgPattern } from '~/lib/bg'
import PatternIntensityField from '~/widgets/TuningFields/PatternIntensityField'
import ToggleField from '~/widgets/TuningFields/ToggleField'

import useSalon from '../../salon/detail_panel/pattern'
import GroupTitle from '../GroupTitle'

type Props = {
  pattern: TBgPattern
  patternIntensity: number
  onTogglePattern: (enabled: boolean) => void
  onPatternToneChange: (lightPattern: boolean) => void
  onPatternIntensityChange: (value: number) => void
  onRangeChangeEnd: () => void
}

export default function Pattern({
  pattern,
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
          checked={pattern.enabled}
          onChange={onTogglePattern}
        />

        {pattern.enabled && (
          <>
            <ToggleField
              label={t('dsb.appearance.wallpaper.editor.invert_tone')}
              checked={pattern.tone === WALLPAPER_PATTERN_TONE.LIGHT}
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
