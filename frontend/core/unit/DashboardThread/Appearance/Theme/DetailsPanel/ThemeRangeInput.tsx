import { useEffect, useState } from 'react'

import useThemeKV from '~/hooks/useThemeKV'
import RangeInput from '~/widgets/RangeInput'

import type { TThemePresetOverwrite } from '../spec'

type TProps = {
  baseKey: keyof TThemePresetOverwrite
  selectedOverwrite: TThemePresetOverwrite
  valueLabel: string
  min: number
  max: number
  onThemePresetPreview: (patch: Partial<TThemePresetOverwrite>) => void
  onThemePresetSchedule: (patch: Partial<TThemePresetOverwrite>) => void
  onThemePresetFlush: () => void
}

export default function ThemeRangeInput({
  baseKey,
  selectedOverwrite,
  valueLabel,
  min,
  max,
  onThemePresetPreview,
  onThemePresetSchedule,
  onThemePresetFlush,
}: TProps) {
  const { key, value } = useThemeKV()
  const activeValue = value(selectedOverwrite, baseKey) as number
  const activeKey = key(baseKey)
  const [displayValue, setDisplayValue] = useState(activeValue)

  useEffect(() => {
    setDisplayValue(activeValue)
  }, [activeValue])

  const getPatch = (value: number): Partial<TThemePresetOverwrite> => ({
    [activeKey]: value,
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
        const patch = getPatch(value)

        setDisplayValue(value)
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
