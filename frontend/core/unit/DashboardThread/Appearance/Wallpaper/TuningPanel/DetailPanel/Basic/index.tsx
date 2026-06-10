import useTrans from '~/hooks/useTrans'
import BlurField from '~/widgets/TuningFields/BlurField'
import BrightnessField from '~/widgets/TuningFields/BrightnessField'
import SaturationField from '~/widgets/TuningFields/SaturationField'

import useSalon from '../../salon/detail_panel/basic'
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
        <BrightnessField
          value={rangeDraft.brightness}
          onChange={onBrightnessChange}
          onChangeEnd={onRangeChangeEnd}
        />

        <SaturationField
          value={rangeDraft.saturation}
          onChange={onSaturationChange}
          onChangeEnd={onRangeChangeEnd}
        />

        <BlurField
          value={rangeDraft.blurIntensity}
          onChange={onBlurIntensityChange}
          onChangeEnd={onRangeChangeEnd}
        />
      </div>
    </section>
  )
}
