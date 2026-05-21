import { useRef, useState } from 'react'

import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'
import RangeInput from '~/widgets/RangeInput'

import { PRESET_FIELD } from '../../constant'
import useSalon from './salon/page_glow'
import useSettingRowSalon from './salon/setting_row'
import type { TThemePresetOverwrite } from './spec'
import TextureBalls from './TextureBalls'

type TProps = {
  selectedOverwrite: TThemePresetOverwrite
  onThemePresetPreview: (patch: Partial<TThemePresetOverwrite>) => void
  onThemePresetSchedule: (patch: Partial<TThemePresetOverwrite>) => void
  onThemePresetFlush: () => void
  onThemePresetCommit: (patch: Partial<TThemePresetOverwrite>) => void
}

type TGlowOpacityRangeProps = {
  value: number
  valueLabel: string
  getPatch: (value: number) => Partial<TThemePresetOverwrite>
  onThemePresetPreview: (patch: Partial<TThemePresetOverwrite>) => void
  onThemePresetSchedule: (patch: Partial<TThemePresetOverwrite>) => void
  onThemePresetFlush: () => void
}

const GlowOpacityRange = ({
  value,
  valueLabel,
  getPatch,
  onThemePresetPreview,
  onThemePresetSchedule,
  onThemePresetFlush,
}: TGlowOpacityRangeProps) => {
  const initialValueRef = useRef(value)
  const [displayGlowOpacity, setDisplayGlowOpacity] = useState(initialValueRef.current)

  return (
    <RangeInput
      value={displayGlowOpacity}
      valueLabel={valueLabel}
      min={0}
      max={100}
      step={0.1}
      unit='%'
      top={0}
      aria-label={valueLabel}
      onChange={(value) => {
        const patch = getPatch(value)

        setDisplayGlowOpacity(value)
        onThemePresetPreview(patch)
        onThemePresetSchedule(patch)
      }}
      onChangeEnd={(value) => {
        onThemePresetSchedule(getPatch(value))
        onThemePresetFlush()
      }}
    />
  )
}

export default function PageGlow({
  selectedOverwrite,
  onThemePresetPreview,
  onThemePresetSchedule,
  onThemePresetFlush,
  onThemePresetCommit,
}: TProps) {
  const s = useSalon()
  const row = useSettingRowSalon()
  const { t } = useTrans()
  const { isLightTheme } = useTheme()
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
          <div className={row.label}>{t('dsb.layout.glow.title')}</div>
          <div className={row.hint}>{t('dsb.layout.glow.desc')}</div>
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
            <div className={row.label}>{t('dsb.layout.glow.intensity.title')}</div>
          </div>

          <div className='grow' />
          <div className={row.rangeGroup}>
            <GlowOpacityRange
              key={`${glowOpacityField}-${glowOpacity}`}
              value={glowOpacity}
              valueLabel={t('dsb.layout.glow.intensity.title')}
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
