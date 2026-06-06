import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from 'react'

import useSalon, { cn } from './salon'

export type TPoint = { x: number; y: number }

type TProps = {
  value: TPoint
  label: string
  disabled?: boolean
  onChange: (center: TPoint) => void
  onCommit?: () => void
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

export default function FocalPointControl({
  value,
  label,
  disabled = false,
  onChange,
  onCommit,
}: TProps) {
  const panelRef = useRef<HTMLButtonElement | null>(null)
  const [draftCenter, setDraftCenter] = useState(value)
  const s = useSalon()

  useEffect(() => {
    setDraftCenter(value)
  }, [value])

  const updateCenter = (clientX: number, clientY: number): void => {
    const rect = panelRef.current?.getBoundingClientRect()
    if (!rect) return

    const nextCenter = {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    }

    setDraftCenter(nextCenter)
    onChange(nextCenter)
  }

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>): void => {
    if (disabled) return

    event.preventDefault()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    updateCenter(event.clientX, event.clientY)
  }

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>): void => {
    if (disabled || !event.currentTarget.hasPointerCapture(event.pointerId)) return
    updateCenter(event.clientX, event.clientY)
  }

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>): void => {
    if (disabled) return

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      updateCenter(event.clientX, event.clientY)
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    onCommit?.()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (disabled) return

    const delta = 0.03
    const nextCenter = {
      x: draftCenter.x,
      y: draftCenter.y,
    }

    if (event.key === 'ArrowLeft') nextCenter.x = clamp01(nextCenter.x - delta)
    else if (event.key === 'ArrowRight') nextCenter.x = clamp01(nextCenter.x + delta)
    else if (event.key === 'ArrowUp') nextCenter.y = clamp01(nextCenter.y - delta)
    else if (event.key === 'ArrowDown') nextCenter.y = clamp01(nextCenter.y + delta)
    else return

    event.preventDefault()
    setDraftCenter(nextCenter)
    onChange(nextCenter)
    onCommit?.()
  }

  const xValue = Math.round(draftCenter.x * 100)
  const yValue = Math.round(draftCenter.y * 100)

  return (
    <button
      type='button'
      ref={panelRef}
      className={cn(s.focalPoint, disabled && s.focalPointDisabled)}
      role='slider'
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={xValue}
      aria-valuetext={`${label}: X ${xValue}%, Y ${yValue}%`}
      aria-disabled={disabled}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={onCommit}
      onKeyDown={handleKeyDown}
    >
      <span className={s.focalPointVerticalLine} style={{ left: '33.333%' }} />
      <span className={s.focalPointVerticalLine} style={{ left: '66.667%' }} />
      <span className={s.focalPointHorizontalLine} style={{ top: '50%' }} />
      <span
        className={s.focalPointDot}
        style={{
          left: `${draftCenter.x * 100}%`,
          top: `${draftCenter.y * 100}%`,
        }}
      />
    </button>
  )
}
