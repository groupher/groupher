import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from 'react'

import useSalon from '../../../salon/tuning_panel/detail_panel/focal_point_control'

export type TCenter = { x: number; y: number }

type Props = {
  center: TCenter
  label: string
  onChange: (center: TCenter) => void
  onCommit: () => void
}

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

export default function FocalPointControl({ center, label, onChange, onCommit }: Props) {
  const panelRef = useRef<HTMLButtonElement | null>(null)
  const [draftCenter, setDraftCenter] = useState(center)
  const s = useSalon()

  useEffect(() => {
    setDraftCenter(center)
  }, [center])

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
    event.preventDefault()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    updateCenter(event.clientX, event.clientY)
  }
  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>): void => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    updateCenter(event.clientX, event.clientY)
  }
  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      updateCenter(event.clientX, event.clientY)
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    onCommit()
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
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
    onCommit()
  }
  const xValue = Math.round(draftCenter.x * 100)
  const yValue = Math.round(draftCenter.y * 100)

  return (
    <button
      type='button'
      ref={panelRef}
      className={s.focalPoint}
      role='slider'
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={xValue}
      aria-valuetext={`${label}: X ${xValue}%, Y ${yValue}%`}
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
