'use client'

/*
 *
 * RangeInput
 *
 */

import {
  type ChangeEvent,
  type CSSProperties,
  type FC,
  type FocusEvent,
  type KeyboardEvent,
  memo,
  type PointerEvent,
  useId,
  useMemo,
} from 'react'

import { cnMerge } from '~/css'
import type { TSpace } from '~/spec'

import { DOT_OFFSET_REM, MAX_RIGHT_DOT_RATIO, MIN_VISUAL_RATIO, TRACK_GAP_REM } from './constant'
import { clamp, defaultFormatValue, getRatio, getVisualRatio } from './helper'
import useSalon from './salon'

type TProps = {
  testid?: string
  id?: string
  value?: number
  min?: number
  max?: number
  step?: number
  unit?: string
  valueLabel?: string
  width?: string
  disabled?: boolean
  className?: string
  'aria-label'?: string
  formatValue?: (value: number) => string
  onChange?: (v: number) => void
  onChangeEnd?: (v: number) => void
} & TSpace

type TRangeVars = CSSProperties & {
  left?: string
  width?: string
}

const RangeInput: FC<TProps> = ({
  testid = 'range-input',
  id,
  value = 50,
  min = 0,
  max = 100,
  step = 1,
  unit = '%',
  valueLabel = 'opacity:',
  width = 'w-full',
  disabled = false,
  className = '',
  formatValue = defaultFormatValue,
  onChange,
  onChangeEnd,
  'aria-label': ariaLabel,
  ...spacing
}) => {
  const reactId = useId()
  const inputId = id || reactId
  const s = useSalon({ width, ...spacing })
  const safeValue = clamp(value, min, max)
  const ratio = clamp(getRatio(safeValue, min, max), 0, 100)
  const visualRatio = getVisualRatio(ratio)
  const showLeftDot = ratio >= MIN_VISUAL_RATIO
  const showRightDot = ratio < MAX_RIGHT_DOT_RATIO

  const activeTrackStyle = useMemo<TRangeVars>(
    () => ({
      width: `max(0px, calc(${visualRatio}% - ${TRACK_GAP_REM / 2}rem))`,
    }),
    [visualRatio],
  )
  const inactiveTrackStyle = useMemo<TRangeVars>(
    () => ({
      width: `max(0px, calc(${100 - visualRatio}% - ${TRACK_GAP_REM / 2}rem))`,
    }),
    [visualRatio],
  )
  const indicatorStyle = useMemo<TRangeVars>(
    () => ({
      left: `${visualRatio}%`,
    }),
    [visualRatio],
  )
  const leftDotStyle = useMemo<TRangeVars>(
    () => ({
      left: `calc(${visualRatio}% - ${DOT_OFFSET_REM}rem)`,
    }),
    [visualRatio],
  )
  const rightDotStyle = useMemo<TRangeVars>(
    () => ({
      left: `calc(${visualRatio}% + ${DOT_OFFSET_REM}rem)`,
    }),
    [visualRatio],
  )
  const updateRangeValue = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = Number.parseFloat(event.target.value)
    onChange?.(nextValue)
  }
  const commitRangeValue = (
    event:
      | FocusEvent<HTMLInputElement>
      | KeyboardEvent<HTMLInputElement>
      | PointerEvent<HTMLInputElement>,
  ) => {
    onChangeEnd?.(Number.parseFloat(event.currentTarget.value))
  }

  return (
    <div className={cnMerge(s.wrapper, disabled && s.disabled, className)} data-testid={testid}>
      <label className='row-center justify-start gap-1 text-sm leading-none' htmlFor={inputId}>
        <span className={s.valueLabelPrefix}>{valueLabel}</span>
        <strong className={s.valueLabelAmount}>
          {formatValue(safeValue)}
          {unit}
        </strong>
      </label>

      <div className={s.control}>
        <div className={s.track} aria-hidden='true'>
          <div
            className={cnMerge(s.trackPart, s.trackLeft, s.activeTrack)}
            style={activeTrackStyle}
          />
          <div
            className={cnMerge(s.trackPart, s.trackRight, s.inactiveTrack)}
            style={inactiveTrackStyle}
          />
          {showLeftDot && <div className={cnMerge(s.dot, s.leftDot)} style={leftDotStyle} />}
          {showRightDot && <div className={cnMerge(s.dot, s.rightDot)} style={rightDotStyle} />}
          <div className={s.indicator} style={indicatorStyle} />
        </div>
        <input
          id={inputId}
          className={s.range}
          value={safeValue}
          type='range'
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          aria-label={ariaLabel || valueLabel}
          onChange={updateRangeValue}
          onBlur={commitRangeValue}
          onKeyUp={commitRangeValue}
          onPointerUp={commitRangeValue}
        />
      </div>
    </div>
  )
}

export default memo(RangeInput)
