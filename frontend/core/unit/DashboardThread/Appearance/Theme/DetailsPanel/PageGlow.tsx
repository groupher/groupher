import useThemeKV from '~/hooks/useThemeKV'
import useTrans from '~/hooks/useTrans'

import { PRESET_FIELD } from '../constant'
import type { TThemeDetails } from '../spec'
import useSalon from './salon/page_glow'
import useSettingRowSalon from './salon/setting_row'
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
    selectedTokens,
    onThemePresetPreview,
    onThemePresetSchedule,
    onThemePresetFlush,
    onThemePresetCommit,
  } = details
  const glowType = value(selectedTokens, PRESET_FIELD.GLOW_TYPE)

  return (
    <>
      <div className={s.settingRow}>
        <div className={row.labelGroup}>
          <div className={row.label}>{t('dsb.appearance.glow.title')}</div>
          <div className={row.hint}>{t('dsb.appearance.glow.desc')}</div>
        </div>

        <div className='grow' />
        <div className={s.swatches}>
          <TextureBalls
            selectedTokens={selectedTokens}
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
              selectedTokens={selectedTokens}
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
