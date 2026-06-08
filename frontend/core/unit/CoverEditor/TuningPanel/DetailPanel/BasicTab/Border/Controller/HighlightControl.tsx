import type { KeyboardEvent, PointerEvent } from 'react'

import type { TBorderHighlight } from '../../../../../spec'
import useLogic from '../../../../../useLogic'
import { CONTROL_LABEL, KEYBOARD_STEP, VIEWBOX } from '../constant'
import {
  clampLength,
  getBorderHighlightFromPoint,
  getHandlePoint,
  getPointFromPointer,
  normalizeAngle,
} from '../helper'
import useSalon, { cn } from './salon/highlight_control'

type TProps = {
  borderHighlight: TBorderHighlight
}

type TPoint = {
  x: number
  y: number
}

const CENTER_TOGGLE_RADIUS = 11
const CENTER_DOT_RADIUS = 7
const HANDLE_RADIUS = 4
const HANDLE_ARC_SPAN = 48

const getDistance = (point: TPoint, center: TPoint): number => {
  const dx = point.x - center.x
  const dy = point.y - center.y

  return Math.sqrt(dx * dx + dy * dy)
}

const getTrimmedLine = (
  start: TPoint,
  end: TPoint,
  startOffset: number,
  endOffset: number,
): { start: TPoint; end: TPoint } | null => {
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

const getArcPoint = (angle: number, radius: number): TPoint => {
  const rad = (normalizeAngle(angle) * Math.PI) / 180

  return {
    x: VIEWBOX.centerX + Math.cos(rad) * radius,
    y: VIEWBOX.centerY + Math.sin(rad) * radius,
  }
}

const getHandleArcPath = (angle: number, radius: number): string => {
  const start = getArcPoint(angle - HANDLE_ARC_SPAN / 2, radius)
  const end = getArcPoint(angle + HANDLE_ARC_SPAN / 2, radius)

  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${radius.toFixed(3)} ${radius.toFixed(
    3,
  )} 0 0 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`
}

export default function HighlightControl({ borderHighlight }: TProps) {
  const s = useSalon()
  const { borderHighlightOnChange } = useLogic()
  const centerPoint = { x: VIEWBOX.centerX, y: VIEWBOX.centerY }
  const handlePoint = getHandlePoint(borderHighlight)
  const handleArcPath = getHandleArcPath(
    borderHighlight.angle,
    getDistance(handlePoint, centerPoint),
  )
  const stickLine = getTrimmedLine(centerPoint, handlePoint, CENTER_DOT_RADIUS, HANDLE_RADIUS)

  const updateFromPointer = (event: PointerEvent<HTMLButtonElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect()
    const next = getBorderHighlightFromPoint(
      getPointFromPointer(event.clientX, event.clientY, rect),
    )

    borderHighlightOnChange({
      enabled: true,
      ...next,
    })
  }

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect()
    const point = getPointFromPointer(event.clientX, event.clientY, rect)
    const isCenterPress = getDistance(point, centerPoint) <= CENTER_TOGGLE_RADIUS

    event.preventDefault()
    event.currentTarget.focus()

    if (isCenterPress) {
      borderHighlightOnChange({ enabled: !borderHighlight.enabled })
      return
    }

    if (!borderHighlight.enabled) return

    event.currentTarget.setPointerCapture(event.pointerId)
    updateFromPointer(event)
  }

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>): void => {
    if (!borderHighlight.enabled) return
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return

    updateFromPointer(event)
  }

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>): void => {
    if (!borderHighlight.enabled) return
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return

    updateFromPointer(event)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      borderHighlightOnChange({ enabled: !borderHighlight.enabled })
      return
    }

    if (!borderHighlight.enabled) return

    let nextAngle = borderHighlight.angle
    let nextLength = borderHighlight.length

    if (event.key === 'ArrowLeft') nextAngle -= KEYBOARD_STEP.ANGLE
    else if (event.key === 'ArrowRight') nextAngle += KEYBOARD_STEP.ANGLE
    else if (event.key === 'ArrowUp') nextLength += KEYBOARD_STEP.LENGTH
    else if (event.key === 'ArrowDown') nextLength -= KEYBOARD_STEP.LENGTH
    else return

    event.preventDefault()
    borderHighlightOnChange({
      enabled: true,
      angle: normalizeAngle(nextAngle),
      length: clampLength(nextLength),
    })
  }

  return (
    <button
      type='button'
      className={cn(s.control, borderHighlight.enabled && s.controlActive)}
      aria-label={CONTROL_LABEL.EDIT}
      aria-pressed={borderHighlight.enabled}
      aria-valuetext={`${Math.round(borderHighlight.angle)}deg ${Math.round(
        borderHighlight.length * 100,
      )}%`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={handleKeyDown}
    >
      <span className={s.verticalLine} style={{ left: '33.333%' }} />
      <span className={s.verticalLine} style={{ left: '66.667%' }} />
      <span className={s.horizontalLine} style={{ top: '50%' }} />
      <svg className={s.svg} viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}>
        {borderHighlight.enabled && (
          <>
            {stickLine && (
              <line
                className={s.stick}
                x1={stickLine.start.x}
                y1={stickLine.start.y}
                x2={stickLine.end.x}
                y2={stickLine.end.y}
              />
            )}
            <path className={s.handleArc} d={handleArcPath} strokeLinecap='round' />
            <circle className={s.handleMask} cx={handlePoint.x} cy={handlePoint.y} r='4.5' />
            <circle className={s.handle} cx={handlePoint.x} cy={handlePoint.y} r={HANDLE_RADIUS} />
          </>
        )}
        <circle
          className={cn(s.center, borderHighlight.enabled && s.centerActive)}
          cx={centerPoint.x}
          cy={centerPoint.y}
          r={CENTER_DOT_RADIUS}
        />
      </svg>
    </button>
  )
}
