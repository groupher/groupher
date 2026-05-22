import useTrans from '~/hooks/useTrans'
import type { TSpace } from '~/spec'

import { FIELD } from '../../constant'
import useSettingRowSalon from './salon/setting_row'
import type { TThemePresetOverwrite } from './spec'
import ThemeRangeInput from './ThemeRangeInput'

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
  const gaussBlurField = isLightTheme ? FIELD.GAUSS_BLUR : FIELD.GAUSS_BLUR_DARK

  const getGaussBlurPatch = (value: number): Partial<TThemePresetOverwrite> => ({
    [gaussBlurField]: value,
  })

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        <div className={s.settingRow}>
          <div className={s.labelGroup}>
            <div className={s.label}>{t('dsb.appearance.theme.glass_opacity.title')}</div>
            <div className={s.hint}>{t('dsb.appearance.theme.glass_opacity.desc')}</div>
          </div>

          <div className='grow' />
          <div className={s.rangeGroup}>
            <ThemeRangeInput
              key={`${gaussBlurField}-${gaussBlur}`}
              value={gaussBlur}
              valueLabel={t('dsb.appearance.theme.glass_opacity.title')}
              min={50}
              max={100}
              getPatch={getGaussBlurPatch}
              onThemePresetPreview={onThemePresetPreview}
              onThemePresetSchedule={onThemePresetSchedule}
              onThemePresetFlush={onThemePresetFlush}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
