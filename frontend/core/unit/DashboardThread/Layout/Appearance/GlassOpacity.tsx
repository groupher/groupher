import { useEffect, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import type { TSpace } from '~/spec'
import RangeInput from '~/widgets/RangeInput'

import { FIELD } from '../../constant'
import useSettingRowSalon from './salon/setting_row'
import type { TThemePresetOverwrite } from './spec'

type TProps = {
  selectedOverwrite: TThemePresetOverwrite
  isLightTheme: boolean
  onThemePresetPreview: (patch: Partial<TThemePresetOverwrite>) => void
  onThemePresetSchedule: (patch: Partial<TThemePresetOverwrite>) => void
  onThemePresetFlush: () => void
} & TSpace

export default function GlassOpacity({
  selectedOverwrite,
  isLightTheme,
  onThemePresetPreview,
  onThemePresetSchedule,
  onThemePresetFlush,
  ...spacing
}: TProps) {
  const s = useSettingRowSalon(spacing)
  const { t } = useTrans()
  const gaussBlur = isLightTheme ? selectedOverwrite.gaussBlur : selectedOverwrite.gaussBlurDark
  const [displayGaussBlur, setDisplayGaussBlur] = useState(gaussBlur)

  useEffect(() => {
    setDisplayGaussBlur(gaussBlur)
  }, [gaussBlur])

  const getGaussBlurPatch = (value: number): Partial<TThemePresetOverwrite> => ({
    [isLightTheme ? FIELD.GAUSS_BLUR : FIELD.GAUSS_BLUR_DARK]: value,
  })

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        <div className={s.settingRow}>
          <div className={s.labelGroup}>
            <div className={s.label}>{t('dsb.layout.appearance.glass_opacity.title')}</div>
            <div className={s.hint}>{t('dsb.layout.appearance.glass_opacity.desc')}</div>
          </div>

          <div className='grow' />
          <div className={s.rangeGroup}>
            <RangeInput
              value={displayGaussBlur}
              valueLabel={t('dsb.layout.appearance.glass_opacity.title')}
              min={50}
              max={100}
              step={0.1}
              unit='%'
              top={0}
              aria-label={t('dsb.layout.appearance.glass_opacity.title')}
              onChange={(value) => {
                const patch = getGaussBlurPatch(value)

                setDisplayGaussBlur(value)
                onThemePresetPreview(patch)
                onThemePresetSchedule(patch)
              }}
              onChangeEnd={(value) => {
                onThemePresetSchedule(getGaussBlurPatch(value))
                onThemePresetFlush()
              }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
