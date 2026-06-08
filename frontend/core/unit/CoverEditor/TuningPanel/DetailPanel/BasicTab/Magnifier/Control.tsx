import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from 'react'

import { MAGNIFIER_ZOOM_RANGE } from '../../../../constant'
import type { TCoverPoint } from '../../../../spec'
import useSalon, { cn } from './salon/control'

export type TMagnifierControlValue = {
  center: TCoverPoint
  radius: number
  zoom: number
}

type TProps = {
  value: TMagnifierControlValue
  label: string
  disabled?: boolean
  onChange: (value: TMagnifierControlValue) => void
  onToggle?: () => void
  onCommit?: () => void
}

type TDragMode = 'center' | 'radius' | 'zoom'

const VIEWBOX = {
  width: 100,
  height: 56.34,
  centerHitRadius: 10,
  handleHitRadius: 8,
  dragThreshold: 2,
  minHandleDistance: 12,
  maxHandleDistance: 32,
  radiusHandleAngle: -Math.PI / 6,
  zoomHandleAngle: Math.PI / 4,
} as const

const KEYBOARD_STEP = {
  center: 0.03,
  radius: 0.04,
} as const

const CENTER_DOT_RADIUS = 6.5
const HANDLE_RADIUS = 4.5
const HANDLE_RING_RADIUS = 4

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

const clampZoom = (zoom: number): number =>
  Math.min(MAGNIFIER_ZOOM_RANGE.MAX, Math.max(MAGNIFIER_ZOOM_RANGE.MIN, Number(zoom.toFixed(1))))

const getCenterPoint = (center: TCoverPoint): TCoverPoint => ({
  x: center.x * VIEWBOX.width,
  y: center.y * VIEWBOX.height,
})

const getHandleDistance = (radius: number): number =>
  VIEWBOX.minHandleDistance +
  clamp01(radius) * (VIEWBOX.maxHandleDistance - VIEWBOX.minHandleDistance)

const getRadiusHandlePoint = ({ center, radius }: TMagnifierControlValue): TCoverPoint => {
  const centerPoint = getCenterPoint(center)
  const distance = getHandleDistance(radius)

  return {
    x: centerPoint.x + Math.cos(VIEWBOX.radiusHandleAngle) * distance,
    y: centerPoint.y + Math.sin(VIEWBOX.radiusHandleAngle) * distance,
  }
}

const getZoomDistance = (zoom: number): number => {
  const zoomRatio =
    (clampZoom(zoom) - MAGNIFIER_ZOOM_RANGE.MIN) /
    (MAGNIFIER_ZOOM_RANGE.MAX - MAGNIFIER_ZOOM_RANGE.MIN)

  return (
    VIEWBOX.minHandleDistance + zoomRatio * (VIEWBOX.maxHandleDistance - VIEWBOX.minHandleDistance)
  )
}

const getZoomHandlePoint = ({ center, zoom }: TMagnifierControlValue): TCoverPoint => {
  const centerPoint = getCenterPoint(center)
  const distance = getZoomDistance(zoom)

  return {
    x: centerPoint.x + Math.cos(VIEWBOX.zoomHandleAngle) * distance,
    y: centerPoint.y + Math.sin(VIEWBOX.zoomHandleAngle) * distance,
  }
}

const getPointFromPointer = (clientX: number, clientY: number, rect: DOMRect): TCoverPoint => ({
  x: ((clientX - rect.left) / rect.width) * VIEWBOX.width,
  y: ((clientY - rect.top) / rect.height) * VIEWBOX.height,
})

const getDistance = (a: TCoverPoint, b: TCoverPoint): number => {
  const dx = a.x - b.x
  const dy = a.y - b.y

  return Math.sqrt(dx * dx + dy * dy)
}

const getTrimmedLine = (
  start: TCoverPoint,
  end: TCoverPoint,
  startOffset: number,
  endOffset: number,
): { start: TCoverPoint; end: TCoverPoint } | null => {
  const distance = getDistance(start, end)
  if (distance <= startOffset + endOffset) return null

  const unitX = (end.x - start.x) / distance
  const unitY = (end.y - start.y) / distance

  return {
    start: {
      x: start.x + unitX * startOffset,
      y: start.y + unitY * startOffset,
    },
    end: {
      x: end.x - unitX * endOffset,
      y: end.y - unitY * endOffset,
    },
  }
}

const getRadiusFromPoint = (point: TCoverPoint, center: TCoverPoint): number => {
  const centerPoint = getCenterPoint(center)
  const dx = point.x - centerPoint.x
  const dy = point.y - centerPoint.y
  const projectedDistance =
    dx * Math.cos(VIEWBOX.radiusHandleAngle) + dy * Math.sin(VIEWBOX.radiusHandleAngle)

  return clamp01(
    (projectedDistance - VIEWBOX.minHandleDistance) /
      (VIEWBOX.maxHandleDistance - VIEWBOX.minHandleDistance),
  )
}

const getZoomFromPoint = (point: TCoverPoint, center: TCoverPoint): number => {
  const centerPoint = getCenterPoint(center)
  const dx = point.x - centerPoint.x
  const dy = point.y - centerPoint.y
  const projectedDistance =
    dx * Math.cos(VIEWBOX.zoomHandleAngle) + dy * Math.sin(VIEWBOX.zoomHandleAngle)
  const zoomRatio = clamp01(
    (projectedDistance - VIEWBOX.minHandleDistance) /
      (VIEWBOX.maxHandleDistance - VIEWBOX.minHandleDistance),
  )

  return clampZoom(
    MAGNIFIER_ZOOM_RANGE.MIN + zoomRatio * (MAGNIFIER_ZOOM_RANGE.MAX - MAGNIFIER_ZOOM_RANGE.MIN),
  )
}

const getCenterFromPoint = (point: TCoverPoint): TCoverPoint => ({
  x: clamp01(point.x / VIEWBOX.width),
  y: clamp01(point.y / VIEWBOX.height),
})

export default function MagnifierControl({
  value,
  label,
  disabled = false,
  onChange,
  onToggle,
  onCommit,
}: TProps) {
  const panelRef = useRef<HTMLButtonElement | null>(null)
  const dragModeRef = useRef<TDragMode | null>(null)
  const pointerStartRef = useRef<TCoverPoint | null>(null)
  const isCenterPressRef = useRef(false)
  const hasDraggedRef = useRef(false)
  const [draftValue, setDraftValue] = useState(value)
  const [isCenterDragging, setIsCenterDragging] = useState(false)
  const s = useSalon()

  useEffect(() => {
    setDraftValue(value)
  }, [value.center.x, value.center.y, value.radius, value.zoom])

  const updateValue = (nextValue: TMagnifierControlValue): void => {
    setDraftValue(nextValue)
    onChange(nextValue)
  }

  const updateFromPoint = (point: TCoverPoint, mode: TDragMode): void => {
    if (mode === 'radius') {
      updateValue({
        ...draftValue,
        radius: getRadiusFromPoint(point, draftValue.center),
      })
      return
    }

    if (mode === 'zoom') {
      updateValue({
        ...draftValue,
        zoom: getZoomFromPoint(point, draftValue.center),
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

    const radiusHandlePoint = getRadiusHandlePoint(draftValue)
    const zoomHandlePoint = getZoomHandlePoint(draftValue)
    const dragMode = isCenterPress
      ? 'center'
      : getDistance(point, radiusHandlePoint) <= VIEWBOX.handleHitRadius
        ? 'radius'
        : getDistance(point, zoomHandlePoint) <= VIEWBOX.handleHitRadius
          ? 'zoom'
          : 'center'

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
      zoom: draftValue.zoom,
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
  const radiusHandlePoint = getRadiusHandlePoint(draftValue)
  const zoomHandlePoint = getZoomHandlePoint(draftValue)
  const radiusLine = getTrimmedLine(
    centerPoint,
    radiusHandlePoint,
    CENTER_DOT_RADIUS,
    HANDLE_RADIUS,
  )
  const zoomLine = getTrimmedLine(centerPoint, zoomHandlePoint, CENTER_DOT_RADIUS, HANDLE_RADIUS)
  const shouldShowRadiusHandle = !disabled && !isCenterDragging
  const ringRadius = 8 + draftValue.radius * 9
  const centerValue = `X ${Math.round(draftValue.center.x * 100)}%, Y ${Math.round(
    draftValue.center.y * 100,
  )}%`
  const statusLabel = disabled
    ? `${label}: Off`
    : `${label}: ${centerValue}, radius ${Math.round(draftValue.radius * 100)}%, zoom ${draftValue.zoom}x`

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
          className={cn(s.lensRing, disabled ? s.lensRingDisabled : s.lensRingActive)}
          cx={centerPoint.x}
          cy={centerPoint.y}
          r={ringRadius}
        />
        <circle
          className={s.lensGlass}
          cx={centerPoint.x - 3}
          cy={centerPoint.y - 3}
          r={ringRadius * 0.72}
        />
        {shouldShowRadiusHandle && (
          <>
            {radiusLine && (
              <line
                className={s.radiusLine}
                x1={radiusLine.start.x}
                y1={radiusLine.start.y}
                x2={radiusLine.end.x}
                y2={radiusLine.end.y}
              />
            )}
            <circle
              className={s.handleMask}
              cx={radiusHandlePoint.x}
              cy={radiusHandlePoint.y}
              r='4.5'
            />
            <circle
              className={s.radiusHandle}
              cx={radiusHandlePoint.x}
              cy={radiusHandlePoint.y}
              r={HANDLE_RING_RADIUS}
            />
            {zoomLine && (
              <line
                className={s.zoomLine}
                x1={zoomLine.start.x}
                y1={zoomLine.start.y}
                x2={zoomLine.end.x}
                y2={zoomLine.end.y}
              />
            )}
            <circle
              className={s.handleMask}
              cx={zoomHandlePoint.x}
              cy={zoomHandlePoint.y}
              r='4.5'
            />
            <circle
              className={s.zoomHandle}
              cx={zoomHandlePoint.x}
              cy={zoomHandlePoint.y}
              r={HANDLE_RING_RADIUS}
            />
          </>
        )}
        <circle
          className={cn(s.centerDot, !disabled && s.centerDotActive)}
          cx={centerPoint.x}
          cy={centerPoint.y}
          r={CENTER_DOT_RADIUS}
        />
      </svg>
    </button>
  )
}
