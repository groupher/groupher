import useTrans from '~/hooks/useTrans'
import type { TSpace } from '~/spec'

import { FIELD } from '../../../constant'
import useSettingRowSalon from '../salon/details_panel/setting_row'
import type { TThemeDetails } from '../spec'
import ThemeRangeInput from './ThemeRangeInput'

type TProps = {
  details: TThemeDetails
} & TSpace

export default function GlassOpacity({ details, ...spacing }: TProps) {
  const s = useSettingRowSalon(spacing)
  const { t } = useTrans()
  const { selectedOverwrite, onThemePresetPreview, onThemePresetSchedule, onThemePresetFlush } =
    details

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
              baseKey={FIELD.GAUSS_BLUR}
              selectedOverwrite={selectedOverwrite}
              valueLabel={t('dsb.appearance.theme.glass_opacity.title')}
              min={50}
              max={100}
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
