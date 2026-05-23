import useThemeKV from '~/hooks/useThemeKV'
import useTrans from '~/hooks/useTrans'

import { PRESET_FIELD } from '../constant'
import useSalon from '../salon/details_panel/page_glow'
import useSettingRowSalon from '../salon/details_panel/setting_row'
import type { TThemeDetails } from '../spec'
import TextureBalls from './TextureBalls'
import ThemeRangeInput from './ThemeRangeInput'

type TProps = {
  details: TThemeDetails
}

export default function PageGlow({ details }: TProps) {
  const s = useSalon()
  const row = useSettingRowSalon()
  const { t } = useTrans()
  const { value } = useThemeKV()

  const {
    selectedOverwrite,
    onThemePresetPreview,
    onThemePresetSchedule,
    onThemePresetFlush,
    onThemePresetCommit,
  } = details
  const glowType = value(selectedOverwrite, PRESET_FIELD.GLOW_TYPE)

  return (
    <>
      <div className={row.settingRow}>
        <div className={row.labelGroup}>
          <div className={row.label}>{t('dsb.appearance.glow.title')}</div>
          <div className={row.hint}>{t('dsb.appearance.glow.desc')}</div>
        </div>

        <div className='grow' />
        <div className={s.swatches}>
          <TextureBalls
            selectedOverwrite={selectedOverwrite}
            onThemePresetCommit={onThemePresetCommit}
            rowClassName={s.swatchRow}
          />
        </div>
      </div>

      {!!glowType && (
        <div className={row.settingRow}>
          <div className={row.labelGroup}>
            <div className={row.label}>{t('dsb.appearance.glow.intensity.title')}</div>
          </div>

          <div className='grow' />
          <div className={row.rangeGroup}>
            <ThemeRangeInput
              baseKey={PRESET_FIELD.GLOW_OPACITY}
              selectedOverwrite={selectedOverwrite}
              valueLabel={t('dsb.appearance.glow.intensity.title')}
              min={0}
              max={100}
              onThemePresetPreview={onThemePresetPreview}
              onThemePresetSchedule={onThemePresetSchedule}
              onThemePresetFlush={onThemePresetFlush}
            />
          </div>
        </div>
      )}
    </>
  )
}
