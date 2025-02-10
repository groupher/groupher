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
  width?: string
  onChange?: (v: number) => void
} & TSpace

// ref: https://codepen.io/thehonestape/pen/DRpEGX
const RangeSlider: FC<TProps> = ({
  testid = 'range-slider',
  value = 0,
  min = -15,
  max = 15,
  width = 'w-auto',
  unit = 'deg',
  onChange,
  ...spacing
}) => {
  const s = useSalon({ width, ...spacing })

  return (
    <div className={s.wrapper} data-testid={testid}>
      <div className={s.value}>
        {value}
        <div className={s.unit}>{unit}</div>
      </div>
      <input
        className={s.range}
        value={value}
        type="range"
        min={min}
        max={max}
        onChange={(v) => onChange(Number.parseInt(v.target.value, 10))}
      />
    </div>
  )
}

export default memo(RangeSlider)
