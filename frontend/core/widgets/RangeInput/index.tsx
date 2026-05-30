'use client'

/*
 *
 * RangeInput
 *
 */

import { type CSSProperties, type FC, memo, useId, useMemo } from 'react'

import { cnMerge } from '~/css'
import type { TSpace } from '~/spec'

import { DOT_OFFSET_REM, MAX_RIGHT_DOT_RATIO, MIN_VISUAL_RATIO, TRACK_GAP_REM } from './constant'
import { clamp, defaultFormatValue, getRatio, getVisualRatio } from './helper'
import useRangeInputLogic from './hooks'
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
  hideLabel?: boolean
  width?: string
  labelPlacement?: 'top' | 'left'
  showValue?: boolean
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
  hideLabel = false,
  width = 'w-full',
  labelPlacement = 'top',
  showValue,
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
  const s = useSalon({ width, labelPlacement, hideLabel, ...spacing })
  const shouldShowValue = !hideLabel && (showValue ?? labelPlacement !== 'left')
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
  const {
    controlRef,
    inputRef,
    updateRangeValue,
    commitRangeValue,
    handleIndicatorPointerDown,
    handleIndicatorPointerMove,
    handleIndicatorPointerUp,
    handleIndicatorPointerCancel,
  } = useRangeInputLogic({
    value: safeValue,
    min,
    max,
    step,
    disabled,
    onChange,
    onChangeEnd,
  })

  return (
    <div className={cnMerge(s.wrapper, disabled && s.disabled, className)} data-testid={testid}>
      <label className={s.valueLabel} htmlFor={inputId}>
        <span className={s.valueLabelPrefix}>{valueLabel}</span>
        {shouldShowValue && (
          <strong className={s.valueLabelAmount}>
            {formatValue(safeValue)}
            {unit}
          </strong>
        )}
      </label>

      <div ref={controlRef} className={s.control}>
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
          <div
            className={s.indicatorHitbox}
            style={indicatorStyle}
            onPointerDown={handleIndicatorPointerDown}
            onPointerMove={handleIndicatorPointerMove}
            onPointerUp={handleIndicatorPointerUp}
            onPointerCancel={handleIndicatorPointerCancel}
          >
            <div className={s.indicator} />
          </div>
        </div>
        <input
          id={inputId}
          ref={inputRef}
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
