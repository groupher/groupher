import useTrans from '~/hooks/useTrans'
import RangeInput from '~/widgets/RangeInput'

import useSalon from '../../../salon/tuning_panel/detail_panel/basic'
import GroupItem from '../GroupItem'
import GroupTitle from '../GroupTitle'

type TRangeDraft = {
  blurIntensity: number
  brightness: number
  saturation: number
}

type Props = {
  rangeDraft: TRangeDraft
  onBlurIntensityChange: (value: number) => void
  onBrightnessChange: (value: number) => void
  onSaturationChange: (value: number) => void
  onRangeChangeEnd: () => void
}

export default function Basic({
  rangeDraft,
  onBlurIntensityChange,
  onBrightnessChange,
  onSaturationChange,
  onRangeChangeEnd,
}: Props) {
  const { t } = useTrans()
  const s = useSalon()

  return (
    <section className={s.wrapper}>
      <GroupTitle>{t('dsb.appearance.wallpaper.editor.basic')}</GroupTitle>

      <div className={s.items}>
        <GroupItem label={t('dsb.appearance.wallpaper.editor.brightness')}>
          <RangeInput
            value={rangeDraft.brightness}
            min={60}
            max={140}
            step={5}
            hideLabel
            valueLabel={t('dsb.appearance.wallpaper.editor.brightness')}
            aria-label={t('dsb.appearance.wallpaper.editor.brightness')}
            onChange={onBrightnessChange}
            onChangeEnd={onRangeChangeEnd}
          />
        </GroupItem>

        <GroupItem label={t('dsb.appearance.wallpaper.editor.saturation')}>
          <RangeInput
            value={rangeDraft.saturation}
            min={0}
            max={160}
            step={5}
            hideLabel
            valueLabel={t('dsb.appearance.wallpaper.editor.saturation')}
            aria-label={t('dsb.appearance.wallpaper.editor.saturation')}
            onChange={onSaturationChange}
            onChangeEnd={onRangeChangeEnd}
          />
        </GroupItem>

        <GroupItem label={t('dsb.appearance.wallpaper.editor.blur')}>
          <RangeInput
            value={rangeDraft.blurIntensity}
            min={0}
            max={100}
            step={5}
            hideLabel
            valueLabel={t('dsb.appearance.wallpaper.editor.blur')}
            aria-label={t('dsb.appearance.wallpaper.editor.blur')}
            onChange={onBlurIntensityChange}
            onChangeEnd={onRangeChangeEnd}
          />
        </GroupItem>
      </div>
    </section>
  )
}
