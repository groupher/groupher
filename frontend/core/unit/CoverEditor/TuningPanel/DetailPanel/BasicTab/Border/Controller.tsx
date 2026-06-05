import type { KeyboardEvent, PointerEvent } from 'react'

import EmptySVG from '~/icons/Empty'

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

export default function Controller({ borderHighlight }: TProps) {
  const s = useSalon()
  const { borderHighlightOnChange } = useLogic()
  const handlePoint = getHandlePoint(borderHighlight)

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
    event.preventDefault()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    updateFromPointer(event)
  }

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>): void => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    updateFromPointer(event)
  }

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>): void => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return

    updateFromPointer(event)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
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
        className={cn(s.emptyItem, !borderHighlight.enabled && s.optionItemActive)}
        aria-label={CONTROL_LABEL.DISABLE}
        onClick={() => borderHighlightOnChange({ enabled: false })}
      >
        <EmptySVG className={s.emptyIcon} />
      </button>

      <button
        type='button'
        className={cn(s.control, borderHighlight.enabled && s.controlActive)}
        aria-label={CONTROL_LABEL.EDIT}
        aria-valuetext={`${Math.round(borderHighlight.angle)}deg ${Math.round(
          borderHighlight.length * 100,
        )}%`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onKeyDown={handleKeyDown}
      >
        <svg className={s.svg} viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}>
          <rect className={s.frame} x='8' y='8' width='84' height='54' rx='8' />
          <line
            className={s.stick}
            x1={VIEWBOX.centerX}
            y1={VIEWBOX.centerY}
            x2={handlePoint.x}
            y2={handlePoint.y}
          />
          <circle className={s.center} cx={VIEWBOX.centerX} cy={VIEWBOX.centerY} r='2.5' />
          <circle className={s.handle} cx={handlePoint.x} cy={handlePoint.y} r='4.5' />
        </svg>
      </button>
    </div>
  )
}
