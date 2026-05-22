import useTrans from '~/hooks/useTrans'

import { PRESET_FIELD } from '../constant'
import useSalon from '../salon/details_panel/page_glow'
import useSettingRowSalon from '../salon/details_panel/setting_row'
import type { TThemeDetails, TThemePresetOverwrite } from '../spec'
import TextureBalls from './TextureBalls'
import ThemeRangeInput from './ThemeRangeInput'

type TProps = {
  details: TThemeDetails
}

export default function PageGlow({ details }: TProps) {
  const s = useSalon()
  const row = useSettingRowSalon()
  const { t } = useTrans()
  const {
    selectedOverwrite,
    isLightTheme,
    onThemePresetPreview,
    onThemePresetSchedule,
    onThemePresetFlush,
    onThemePresetCommit,
  } = details
  const glowTypeField = isLightTheme ? PRESET_FIELD.GLOW_TYPE : PRESET_FIELD.GLOW_TYPE_DARK
  const glowOpacityField = isLightTheme ? PRESET_FIELD.GLOW_OPACITY : PRESET_FIELD.GLOW_OPACITY_DARK
  const glowType = isLightTheme ? selectedOverwrite.glowType : selectedOverwrite.glowTypeDark
  const glowOpacity = isLightTheme
    ? selectedOverwrite.glowOpacity
    : selectedOverwrite.glowOpacityDark

  const getGlowOpacityPatch = (value: number): Partial<TThemePresetOverwrite> => ({
    [glowOpacityField]: value,
  })

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
            glowType={glowType}
            glowTypeField={glowTypeField}
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
              value={glowOpacity}
              valueLabel={t('dsb.appearance.glow.intensity.title')}
              min={0}
              max={100}
              getPatch={getGlowOpacityPatch}
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
