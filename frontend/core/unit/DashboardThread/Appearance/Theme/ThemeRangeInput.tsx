import { useRef, useState } from 'react'

import RangeInput from '~/widgets/RangeInput'

import type { TThemePresetOverwrite } from './spec'

type TProps = {
  value: number
  valueLabel: string
  min: number
  max: number
  getPatch: (value: number) => Partial<TThemePresetOverwrite>
  onThemePresetPreview: (patch: Partial<TThemePresetOverwrite>) => void
  onThemePresetSchedule: (patch: Partial<TThemePresetOverwrite>) => void
  onThemePresetFlush: () => void
}

export default function ThemeRangeInput({
  value,
  valueLabel,
  min,
  max,
  getPatch,
  onThemePresetPreview,
  onThemePresetSchedule,
  onThemePresetFlush,
}: TProps) {
  const initialValueRef = useRef(value)
  const [displayValue, setDisplayValue] = useState(initialValueRef.current)

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
