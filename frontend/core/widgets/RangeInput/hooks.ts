import {
  type ChangeEvent,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  useRef,
} from 'react'

import { clamp, getRatioFromVisualRatio } from './helper'

type TArgs = {
  value: number
  min: number
  max: number
  step: number
  disabled: boolean
  onChange?: (value: number) => void
  onChangeEnd?: (value: number) => void
}

const getStepPrecision = (step: number): number => {
  const stepText = String(step)
  if (stepText.includes('e-')) return Number(stepText.split('e-')[1])

  return stepText.split('.')[1]?.length || 0
}

export default function useRangeInputLogic({
  value,
  min,
  max,
  step,
  disabled,
  onChange,
  onChangeEnd,
}: TArgs) {
  const controlRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const dragValueRef = useRef(value)

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
  const getPointerValue = (clientX: number): number => {
    const rect = controlRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return value

    const pointerVisualRatio = clamp(((clientX - rect.left) / rect.width) * 100, 0, 100)
    const pointerRatio = getRatioFromVisualRatio(pointerVisualRatio)
    const rawValue = min + (pointerRatio / 100) * (max - min)
    const steppedValue = step > 0 ? min + Math.round((rawValue - min) / step) * step : rawValue

    return clamp(Number(steppedValue.toFixed(getStepPrecision(step))), min, max)
  }
  const updatePointerValue = (clientX: number) => {
    const nextValue = getPointerValue(clientX)

    dragValueRef.current = nextValue
    onChange?.(nextValue)
  }
  // The indicator is above the transparent range input so it can keep indicator-only hover.
  // When it captures pointer events, mirror range dragging instead of letting the hitbox block input drag.
  const handleIndicatorPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled) return

    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    inputRef.current?.focus()
    updatePointerValue(event.clientX)
  }
  const handleIndicatorPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return

    updatePointerValue(event.clientX)
  }
  const handleIndicatorPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return

    event.currentTarget.releasePointerCapture(event.pointerId)
    updatePointerValue(event.clientX)
    onChangeEnd?.(dragValueRef.current)
  }
  const handleIndicatorPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return

    event.currentTarget.releasePointerCapture(event.pointerId)
    onChangeEnd?.(dragValueRef.current)
  }

  return {
    controlRef,
    inputRef,
    updateRangeValue,
    commitRangeValue,
    handleIndicatorPointerDown,
    handleIndicatorPointerMove,
    handleIndicatorPointerUp,
    handleIndicatorPointerCancel,
  }
}
