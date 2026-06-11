import { PRESET_FIELD } from '~/const/theme_preset'
import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'

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
  const { theme } = useTheme()

  const {
    selectedTokens,
    onThemePresetPreview,
    onThemePresetSchedule,
    onThemePresetFlush,
    onThemePresetCommit,
  } = details
  const glowType = selectedTokens[theme].glowType

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
