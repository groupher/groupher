/*
 *
 * RangeSlider
 *
 */

import { type FC, memo } from 'react'

import type { TSpace } from '~/spec'
import useSalon from './salon'

type TProps = {
  testid?: string
  value?: number
  unit?: string
  min?: number
  max?: number
  step?: number
  width?: string
  onChange?: (v: number) => void
} & TSpace

// ref: https://codepen.io/thehonestape/pen/DRpEGX
const RangeSlider: FC<TProps> = ({
  testid = 'range-slider',
  value = 0,
  min = -15,
  max = 15,
  step = 1,
  width = 'w-auto',
  unit = 'deg',
  onChange,
  ...spacing
}) => {
  const s = useSalon({ width, ...spacing })

  return (
    <div className={s.wrapper} data-testid={testid}>
      <div className={s.value}>
        {Number.isInteger(value) ? value : value.toFixed(1)}
        <div className={s.unit}>{unit}</div>
      </div>
      <input
        className={s.range}
        value={value}
        type='range'
        min={min}
        max={max}
        step={step}
        onChange={(v) => onChange(Number.parseFloat(v.target.value))}
      />
    </div>
  )
}

export default memo(RangeSlider)
