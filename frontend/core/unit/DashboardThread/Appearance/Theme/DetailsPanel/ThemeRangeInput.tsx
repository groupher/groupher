import { useState } from 'react'

import { PRESET_FIELD } from '~/const/theme_preset'
import useTheme from '~/hooks/useTheme'
import RangeInput from '~/widgets/RangeInput'

import type { TThemePresetOverwrite, TThemePresetTokens } from '../spec'

type TNumericRangeKey = typeof PRESET_FIELD.GAUSS_BLUR | typeof PRESET_FIELD.GLOW_OPACITY

type TProps = {
  baseKey: TNumericRangeKey
  selectedTokens: TThemePresetTokens
  valueLabel: string
  min: number
  max: number
  onThemePresetPreview: (overwrite: TThemePresetOverwrite) => void
  onThemePresetSchedule: (overwrite: TThemePresetOverwrite) => void
  onThemePresetFlush: () => void
}

export default function ThemeRangeInput({
  baseKey,
  selectedTokens,
  valueLabel,
  min,
  max,
  onThemePresetPreview,
  onThemePresetSchedule,
  onThemePresetFlush,
}: TProps) {
  const { theme } = useTheme()
  const activeValue = selectedTokens[theme][baseKey] as number
  const [draftValue, setDraftValue] = useState({
    sourceValue: activeValue,
    value: activeValue,
  })
  const displayValue = draftValue.sourceValue === activeValue ? draftValue.value : activeValue

  const getOverwrite = (value: number): TThemePresetOverwrite => ({
    [theme]: { [baseKey]: value },
  })

  return (
    <RangeInput
      value={displayValue}
      valueLabel={valueLabel}
      min={min}
      max={max}
      step={0.1}
      unit='%'
      top={0}
      aria-label={valueLabel}
      onChange={(value) => {
        const overwrite = getOverwrite(value)

        setDraftValue({ sourceValue: activeValue, value })
        onThemePresetPreview(overwrite)
        onThemePresetSchedule(overwrite)
      }}
      onChangeEnd={(value) => {
        onThemePresetSchedule(getOverwrite(value))
        onThemePresetFlush()
      }}
    />
  )
}
