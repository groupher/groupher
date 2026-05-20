import useTrans from '~/hooks/useTrans'
import useSalon from '~/widgets/CustomPageBg/salon'
import RangeInput from '~/widgets/RangeInput'

import { FIELD } from '../../constant'
import type { TThemePresetOverrides } from './spec'

type TProps = {
  selectedOverrides: TThemePresetOverrides
  isLightTheme: boolean
  onThemePresetCommit: (patch: Partial<TThemePresetOverrides>) => void
}

export default function GlassOpacity({
  selectedOverrides,
  isLightTheme,
  onThemePresetCommit,
}: TProps) {
  const s = useSalon()
  const { t } = useTrans()
  const gaussBlur = isLightTheme ? selectedOverrides.gaussBlur : selectedOverrides.gaussBlurDark

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        <div className={s.settingRow}>
          <div className={s.labelGroup}>
            <div className={s.label}>{t('dsb.layout.gauss_blur.opacity.title')}</div>
            <div className={s.hint}>{t('dsb.layout.gauss_blur.opacity.desc')}</div>
          </div>

          <div className='grow' />
          <div className={s.rangeGroup}>
            <RangeInput
              value={gaussBlur}
              valueLabel={t('dsb.layout.gauss_blur.opacity.title')}
              min={50}
              max={100}
              step={0.1}
              unit='%'
              top={0}
              aria-label='Glass opacity'
              onChange={(value) => {
                onThemePresetCommit({
                  [isLightTheme ? FIELD.GAUSS_BLUR : FIELD.GAUSS_BLUR_DARK]: value,
                })
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
