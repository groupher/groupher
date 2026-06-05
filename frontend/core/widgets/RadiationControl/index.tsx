import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from 'react'

import useSalon, { cn } from './salon'

export type TPoint = { x: number; y: number }

export type TRadiationValue = {
  center: TPoint
  radius: number
}

type TProps = {
  value: TRadiationValue
  label: string
  disabled?: boolean
  onChange: (value: TRadiationValue) => void
  onToggle?: () => void
  onCommit?: () => void
}

type TDragMode = 'center' | 'radius'

const VIEWBOX = {
  width: 100,
  height: 50,
  centerHitRadius: 10,
  handleHitRadius: 8,
  dragThreshold: 2,
  minHandleDistance: 12,
  maxHandleDistance: 32,
  handleAngle: 0,
} as const

const KEYBOARD_STEP = {
  center: 0.03,
  radius: 0.04,
} as const

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

const getCenterPoint = (center: TPoint): TPoint => ({
  x: center.x * VIEWBOX.width,
  y: center.y * VIEWBOX.height,
})

const getHandleDistance = (radius: number): number =>
  VIEWBOX.minHandleDistance +
  clamp01(radius) * (VIEWBOX.maxHandleDistance - VIEWBOX.minHandleDistance)

const getHandlePoint = ({ center, radius }: TRadiationValue): TPoint => {
  const centerPoint = getCenterPoint(center)
  const distance = getHandleDistance(radius)

  return {
    x: centerPoint.x + Math.cos(VIEWBOX.handleAngle) * distance,
    y: centerPoint.y + Math.sin(VIEWBOX.handleAngle) * distance,
  }
}

const getPointFromPointer = (clientX: number, clientY: number, rect: DOMRect): TPoint => ({
  x: ((clientX - rect.left) / rect.width) * VIEWBOX.width,
  y: ((clientY - rect.top) / rect.height) * VIEWBOX.height,
})

const getDistance = (a: TPoint, b: TPoint): number => {
  const dx = a.x - b.x
  const dy = a.y - b.y

  return Math.sqrt(dx * dx + dy * dy)
}

const getRadiusFromPoint = (point: TPoint, center: TPoint): number => {
  const centerPoint = getCenterPoint(center)
  const dx = point.x - centerPoint.x
  const dy = point.y - centerPoint.y
  const projectedDistance = dx * Math.cos(VIEWBOX.handleAngle) + dy * Math.sin(VIEWBOX.handleAngle)

  return clamp01(
    (projectedDistance - VIEWBOX.minHandleDistance) /
      (VIEWBOX.maxHandleDistance - VIEWBOX.minHandleDistance),
  )
}

const getCenterFromPoint = (point: TPoint): TPoint => ({
  x: clamp01(point.x / VIEWBOX.width),
  y: clamp01(point.y / VIEWBOX.height),
})

export default function RadiationControl({
  value,
  label,
  disabled = false,
  onChange,
  onToggle,
  onCommit,
}: TProps) {
  const panelRef = useRef<HTMLButtonElement | null>(null)
  const dragModeRef = useRef<TDragMode | null>(null)
  const pointerStartRef = useRef<TPoint | null>(null)
  const isCenterPressRef = useRef(false)
  const hasDraggedRef = useRef(false)
  const [draftValue, setDraftValue] = useState(value)
  const [isCenterDragging, setIsCenterDragging] = useState(false)
  const s = useSalon()

  useEffect(() => {
    setDraftValue(value)
  }, [value.center.x, value.center.y, value.radius])

  const updateValue = (nextValue: TRadiationValue): void => {
    setDraftValue(nextValue)
    onChange(nextValue)
  }

  const updateFromPoint = (point: TPoint, mode: TDragMode): void => {
    if (mode === 'radius') {
      updateValue({
        ...draftValue,
        radius: getRadiusFromPoint(point, draftValue.center),
      })
      return
    }

    updateValue({
      ...draftValue,
      center: getCenterFromPoint(point),
    })
  }

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect()
    const point = getPointFromPointer(event.clientX, event.clientY, rect)
    const centerPoint = getCenterPoint(draftValue.center)
    const isCenterPress = getDistance(point, centerPoint) <= VIEWBOX.centerHitRadius

    event.preventDefault()
    event.currentTarget.focus()

    if (disabled && !isCenterPress) return

    const handlePoint = getHandlePoint(draftValue)
    const dragMode =
      isCenterPress || getDistance(point, handlePoint) > VIEWBOX.handleHitRadius
        ? 'center'
        : 'radius'

    isCenterPressRef.current = isCenterPress
    hasDraggedRef.current = false
    pointerStartRef.current = point
    dragModeRef.current = dragMode
    event.currentTarget.setPointerCapture(event.pointerId)

    if (!isCenterPress) {
      if (dragMode === 'center') setIsCenterDragging(true)
      updateFromPoint(point, dragMode)
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>): void => {
    const dragMode = dragModeRef.current
    if (!dragMode || !event.currentTarget.hasPointerCapture(event.pointerId)) return

    const rect = event.currentTarget.getBoundingClientRect()
    const point = getPointFromPointer(event.clientX, event.clientY, rect)
    const startPoint = pointerStartRef.current

    if (startPoint && getDistance(point, startPoint) > VIEWBOX.dragThreshold) {
      hasDraggedRef.current = true
      if (dragMode === 'center') setIsCenterDragging(true)
    }

    if (disabled) return
    if (isCenterPressRef.current && !hasDraggedRef.current) return

    updateFromPoint(point, dragMode)
  }

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>): void => {
    const dragMode = dragModeRef.current
    if (!dragMode || !event.currentTarget.hasPointerCapture(event.pointerId)) return

    if (isCenterPressRef.current && !hasDraggedRef.current) {
      onToggle?.()
      onCommit?.()
    } else if (!disabled) {
      const rect = event.currentTarget.getBoundingClientRect()
      updateFromPoint(getPointFromPointer(event.clientX, event.clientY, rect), dragMode)
      onCommit?.()
    }

    dragModeRef.current = null
    pointerStartRef.current = null
    isCenterPressRef.current = false
    hasDraggedRef.current = false
    setIsCenterDragging(false)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggle?.()
      onCommit?.()
      return
    }

    if (disabled) return

    const nextValue = {
      center: { ...draftValue.center },
      radius: draftValue.radius,
    }

    if (event.shiftKey) {
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        nextValue.radius = clamp01(nextValue.radius + KEYBOARD_STEP.radius)
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        nextValue.radius = clamp01(nextValue.radius - KEYBOARD_STEP.radius)
      } else {
        return
      }
    } else if (event.key === 'ArrowLeft') {
      nextValue.center.x = clamp01(nextValue.center.x - KEYBOARD_STEP.center)
    } else if (event.key === 'ArrowRight') {
      nextValue.center.x = clamp01(nextValue.center.x + KEYBOARD_STEP.center)
    } else if (event.key === 'ArrowUp') {
      nextValue.center.y = clamp01(nextValue.center.y - KEYBOARD_STEP.center)
    } else if (event.key === 'ArrowDown') {
      nextValue.center.y = clamp01(nextValue.center.y + KEYBOARD_STEP.center)
    } else {
      return
    }

    event.preventDefault()
    updateValue(nextValue)
    onCommit?.()
  }

  const centerPoint = getCenterPoint(draftValue.center)
  const handlePoint = getHandlePoint(draftValue)
  const shouldShowRadiusHandle = !disabled && !isCenterDragging
  const ringRadius = 8 + draftValue.radius * 8
  const centerValue = `X ${Math.round(draftValue.center.x * 100)}%, Y ${Math.round(
    draftValue.center.y * 100,
  )}%`
  const statusLabel = disabled
    ? `${label}: Off`
    : `${label}: ${centerValue}, radius ${Math.round(draftValue.radius * 100)}%`

  return (
    <button
      type='button'
      ref={panelRef}
      className={cn(s.control, !disabled && s.controlActive)}
      aria-label={statusLabel}
      aria-pressed={!disabled}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      <span className={s.verticalLine} style={{ left: '33.333%' }} />
      <span className={s.verticalLine} style={{ left: '66.667%' }} />
      <span className={s.horizontalLine} style={{ top: '50%' }} />

      <svg className={s.svg} viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`} aria-hidden>
        <circle
          className={cn(
            s.radiationRing,
            disabled ? s.radiationRingDisabled : s.radiationRingActive,
          )}
          cx={centerPoint.x}
          cy={centerPoint.y}
          r={ringRadius}
        />
        {shouldShowRadiusHandle && (
          <>
            <line
              className={s.radiusLine}
              x1={centerPoint.x}
              y1={centerPoint.y}
              x2={handlePoint.x}
              y2={handlePoint.y}
            />
            <circle className={s.handle} cx={handlePoint.x} cy={handlePoint.y} r='4.5' />
          </>
        )}
        <circle
          className={cn(s.centerDot, !disabled && s.centerDotActive)}
          cx={centerPoint.x}
          cy={centerPoint.y}
          r='6.5'
        />
      </svg>
    </button>
  )
}
