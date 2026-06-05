import type { KeyboardEvent, PointerEvent } from 'react'

import type { TBorderHighlight } from '../../../../spec'
import useLogic from '../../../../useLogic'
import { CONTROL_LABEL, KEYBOARD_STEP, VIEWBOX } from './constant'
import {
  clampLength,
  getBorderHighlightFromPoint,
  getHandlePoint,
  getPointFromPointer,
  normalizeAngle,
} from './helper'
import useSalon, { cn } from './salon/controller'

type TProps = {
  borderHighlight: TBorderHighlight
}

const CENTER_TOGGLE_RADIUS = 11
const HANDLE_ARC_SPAN = 48

const getDistance = (point: { x: number; y: number }, center: { x: number; y: number }): number => {
  const dx = point.x - center.x
  const dy = point.y - center.y

  return Math.sqrt(dx * dx + dy * dy)
}

const getArcPoint = (angle: number, radius: number): { x: number; y: number } => {
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

export default function Controller({ borderHighlight }: TProps) {
  const s = useSalon()
  const { borderHighlightOnChange } = useLogic()
  const handlePoint = getHandlePoint(borderHighlight)
  const handleArcPath = getHandleArcPath(
    borderHighlight.angle,
    getDistance(handlePoint, { x: VIEWBOX.centerX, y: VIEWBOX.centerY }),
  )

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
    const isCenterPress =
      getDistance(point, { x: VIEWBOX.centerX, y: VIEWBOX.centerY }) <= CENTER_TOGGLE_RADIUS

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
    <div className={s.wrapper}>
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
              <line
                className={s.stick}
                x1={VIEWBOX.centerX}
                y1={VIEWBOX.centerY}
                x2={handlePoint.x}
                y2={handlePoint.y}
              />
              <path className={s.handleArc} d={handleArcPath} strokeLinecap='round' />
              <circle className={s.handle} cx={handlePoint.x} cy={handlePoint.y} r='4.5' />
            </>
          )}
          <circle
            className={cn(s.center, borderHighlight.enabled && s.centerActive)}
            cx={VIEWBOX.centerX}
            cy={VIEWBOX.centerY}
            r='7'
          />
        </svg>
      </button>
    </div>
  )
}
