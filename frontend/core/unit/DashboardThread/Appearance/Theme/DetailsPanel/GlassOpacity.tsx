import useTrans from '~/hooks/useTrans'
import type { TSpace } from '~/spec'

import { FIELD } from '../../../constant'
import useSettingRowSalon from '../salon/details_panel/setting_row'
import type { TThemeDetails, TThemePresetOverwrite } from '../spec'
import ThemeRangeInput from './ThemeRangeInput'

type TProps = {
  details: TThemeDetails
} & TSpace

export default function GlassOpacity({ details, ...spacing }: TProps) {
  const s = useSettingRowSalon(spacing)
  const { t } = useTrans()
  const {
    selectedOverwrite,
    isLightTheme,
    onThemePresetPreview,
    onThemePresetSchedule,
    onThemePresetFlush,
  } = details
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
