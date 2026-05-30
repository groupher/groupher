import SIZE from '~/const/size'
import { WALLPAPER_PATTERN_TONE } from '~/const/wallpaper'
import useTrans from '~/hooks/useTrans'
import type { TWallpaperPatternTone } from '~/spec'
import ToggleSwitch from '~/widgets/Buttons/ToggleSwitch'
import RangeInput from '~/widgets/RangeInput'

import useSalon from '../../../salon/tuning_panel/detail_panel/pattern'
import GroupItem from '../GroupItem'
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
        <GroupItem label={t('dsb.appearance.wallpaper.editor.enable')}>
          <ToggleSwitch size={SIZE.TINY} checked={hasPattern} onChange={onTogglePattern} />
        </GroupItem>

        {hasPattern && (
          <>
            <GroupItem label={t('dsb.appearance.wallpaper.editor.invert_tone')}>
              <ToggleSwitch
                size={SIZE.TINY}
                checked={patternTone === WALLPAPER_PATTERN_TONE.LIGHT}
                onChange={onPatternToneChange}
              />
            </GroupItem>

            <GroupItem label={t('dsb.appearance.wallpaper.editor.pattern_intensity')}>
              <RangeInput
                value={patternIntensity}
                min={0}
                max={100}
                step={5}
                hideLabel
                valueLabel={t('dsb.appearance.wallpaper.editor.pattern_intensity')}
                aria-label={t('dsb.appearance.wallpaper.editor.pattern_intensity')}
                onChange={onPatternIntensityChange}
                onChangeEnd={onRangeChangeEnd}
              />
            </GroupItem>
          </>
        )}
      </div>
    </section>
  )
}
