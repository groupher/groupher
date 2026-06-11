import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from 'react'

import ArrowsOutCardinalSVG from '~/icons/ArrowsOutCardinal'

import { IMAGE_SIZE_RANGE } from '../../../../constant'
import { getImagePlacement, getResponsiveImageSize } from '../../../../salon/metric'
import type { TCoverPoint, TImageSize } from '../../../../spec'
import {
  GRID_HORIZONTAL_LINES,
  GRID_VERTICAL_LINES,
  POSITION_PREVIEW_FRAME_SCALE,
} from './constant'
import { getPositionFromKeyboard, getPositionFromPointer } from './helper'
import useSalon, { cn } from './salon/controller'

type TProps = {
  position: TCoverPoint
  size: TImageSize
  rotate: number
  onChange: (position: TCoverPoint) => void
  onCommit?: () => void
}

export default function Controller({ position, size, rotate, onChange, onCommit }: TProps) {
  const panelRef = useRef<HTMLButtonElement | null>(null)
  const [draftPosition, setDraftPosition] = useState(position)
  const [isDragging, setIsDragging] = useState(false)
  const s = useSalon()

  useEffect(() => {
    setDraftPosition(position)
  }, [position])

  const updatePosition = (clientX: number, clientY: number): void => {
    const rect = panelRef.current?.getBoundingClientRect()
    if (!rect) return

    const nextPosition = getPositionFromPointer(clientX, clientY, rect, { size, rotate })

    setDraftPosition(nextPosition)
    onChange(nextPosition)
  }

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(true)
    updatePosition(event.clientX, event.clientY)
  }

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>): void => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    updatePosition(event.clientX, event.clientY)
  }

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>): void => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      setIsDragging(false)
      return
    }

    updatePosition(event.clientX, event.clientY)
    event.currentTarget.releasePointerCapture(event.pointerId)
    setIsDragging(false)
    onCommit?.()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const nextPosition = getPositionFromKeyboard(draftPosition, event.key)
    if (!nextPosition) return

    event.preventDefault()
    setDraftPosition(nextPosition)
    onChange(nextPosition)
    onCommit?.()
  }

  const frameSize = getResponsiveImageSize(size)
  const previewFrameScale = size >= IMAGE_SIZE_RANGE.MAX ? 1 : POSITION_PREVIEW_FRAME_SCALE
  const previewFrameSize = {
    width: `${Number.parseFloat(frameSize.width) * previewFrameScale}%`,
    height: `${Number.parseFloat(frameSize.height) * previewFrameScale}%`,
  }
  const placement = getImagePlacement(draftPosition, size, rotate)

  return (
    <button
      type='button'
      ref={panelRef}
      className={s.control}
      role='slider'
      aria-label='Position'
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(draftPosition.x * 100)}
      aria-valuetext={`X ${Math.round(draftPosition.x * 100)}%, Y ${Math.round(
        draftPosition.y * 100,
      )}%`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      {GRID_VERTICAL_LINES.map((left) => (
        <span key={left} className={s.verticalLine} style={{ left: `${left}%` }} />
      ))}
      {GRID_HORIZONTAL_LINES.map((top) => (
        <span key={top} className={s.horizontalLine} style={{ top: `${top}%` }} />
      ))}
      <span
        className={s.frameBlock}
        style={{
          width: previewFrameSize.width,
          height: previewFrameSize.height,
          left: placement.left,
          top: placement.top,
          transform: `translate(-50%, -50%) rotate(${rotate}deg)`,
        }}
      >
        <span className={s.frameFill} />
        <ArrowsOutCardinalSVG
          className={cn(s.dragIcon, isDragging ? s.dragIconDragging : s.dragIconIdle)}
          aria-hidden='true'
        />
      </span>
    </button>
  )
}
