import {
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import { normalizeSignedAngle } from '~/lib/angle'

import { MAJOR_TICK_STEP, TICKS, WHEEL_SIZE } from './constant'
import { angleFromPointer, arcPathFromAngle, pointFromAngle, tickLineFromAngle } from './helper'
import useSalon from './salon'

type TProps = {
  value: number
  label?: string
  onChange: (angle: number) => void
  onCommit?: () => void
}

export default function AngleWheel({ value, label = 'Angle', onChange, onCommit }: TProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [angle, setAngle] = useState(() => normalizeSignedAngle(value))
  const [dragging, setDragging] = useState(false)
  const s = useSalon()

  const pointStyle = pointFromAngle(angle)
  const guidePath = arcPathFromAngle(angle)
  const isNegative = angle < 0
  const displayAngle = Math.abs(angle)

  useEffect(() => {
    setAngle(normalizeSignedAngle(value))
  }, [value])

  const commitAngle = useCallback(
    (angle: number) => {
      const nextAngle = normalizeSignedAngle(angle)
      setAngle(nextAngle)
      onChange(nextAngle)
    },
    [onChange],
  )

  const updateAngle = useCallback(
    (clientX: number, clientY: number) => {
      const rect = panelRef.current?.getBoundingClientRect()
      if (!rect) return

      commitAngle(angleFromPointer(clientX, clientY, rect))
    },
    [commitAngle],
  )

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    const isIncrease = event.key === 'ArrowRight' || event.key === 'ArrowUp'
    const isDecrease = event.key === 'ArrowLeft' || event.key === 'ArrowDown'

    if (!isIncrease && !isDecrease) return

    event.preventDefault()
    commitAngle(angle + (isIncrease ? 1 : -1))
    onCommit?.()
  }

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setDragging(true)
    updateAngle(event.clientX, event.clientY)
  }

  const handleClick = (event: MouseEvent<HTMLDivElement>): void => {
    updateAngle(event.clientX, event.clientY)
  }

  const handleResetMouseDown = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation()
  }

  const handleResetClick = (event: MouseEvent<HTMLButtonElement>): void => {
    event.stopPropagation()
    commitAngle(0)
    onCommit?.()
  }

  useEffect(() => {
    if (!dragging) return

    const handleMouseMove = (event: globalThis.MouseEvent): void => {
      updateAngle(event.clientX, event.clientY)
    }
    const handleMouseUp = (event: globalThis.MouseEvent): void => {
      updateAngle(event.clientX, event.clientY)
      setDragging(false)
      onCommit?.()
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging, onCommit, updateAngle])

  return (
    <div
      ref={panelRef}
      className={s.wrapper}
      role='slider'
      tabIndex={0}
      aria-label={label}
      aria-valuemin={-180}
      aria-valuemax={180}
      aria-valuenow={angle}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <svg className={s.guide} viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`} aria-hidden='true'>
        <g className={s.ticks(dragging)}>
          {TICKS.map((tickAngle) => {
            const major = tickAngle % MAJOR_TICK_STEP === 0
            const line = tickLineFromAngle(tickAngle, major)

            return (
              <line
                key={tickAngle}
                className={major ? s.majorTick : s.tick}
                x1={line.x1.toFixed(3)}
                y1={line.y1.toFixed(3)}
                x2={line.x2.toFixed(3)}
                y2={line.y2.toFixed(3)}
                strokeLinecap='round'
              />
            )
          })}
        </g>
        <path className={s.guideArc} d={guidePath} strokeLinecap='round' />
      </svg>
      <button
        type='button'
        className={s.center}
        aria-label='Reset angle to 0 degrees'
        onMouseDown={handleResetMouseDown}
        onClick={handleResetClick}
      >
        {isNegative && <span className={s.negativeSign}>-</span>}
        <span>{displayAngle}°</span>
      </button>
      <div className={s.point} style={pointStyle} />
    </div>
  )
}
