import {
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import useSalon from './salon'

const WHEEL_SIZE = 56
const WHEEL_RADIUS = WHEEL_SIZE / 2
const DOT_SIZE = 10
const GUIDE_ARC_SPAN = 78
const SNAP_STEP = 45
const SNAP_THRESHOLD = 1

type TProps = {
  value: number
  label?: string
  onChange: (angle: number) => void
  onCommit?: () => void
}

const normalizeAngle = (angle: number): number => Math.round(((angle % 360) + 360) % 360)

const circularDistance = (angle: number, target: number): number => {
  const diff = Math.abs(normalizeAngle(angle) - normalizeAngle(target))

  return Math.min(diff, 360 - diff)
}

const snapAngle = (angle: number): number => {
  const normalizedAngle = normalizeAngle(angle)
  const target = Math.round(normalizedAngle / SNAP_STEP) * SNAP_STEP

  if (circularDistance(normalizedAngle, target) <= SNAP_THRESHOLD) {
    return normalizeAngle(target)
  }

  return normalizedAngle
}

const angleFromPointer = (clientX: number, clientY: number, rect: DOMRect): number => {
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const mathAngle = (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI

  return snapAngle(mathAngle + 90)
}

const pointFromAngle = (angle: number): { left: number; top: number } => {
  const rad = (angle * Math.PI) / 180
  const x = Math.sin(rad) * WHEEL_RADIUS
  const y = -Math.cos(rad) * WHEEL_RADIUS

  return {
    left: WHEEL_RADIUS + x - DOT_SIZE / 2,
    top: WHEEL_RADIUS + y - DOT_SIZE / 2,
  }
}

const svgPointFromAngle = (angle: number): { x: number; y: number } => {
  const rad = (angle * Math.PI) / 180

  return {
    x: WHEEL_RADIUS + Math.sin(rad) * WHEEL_RADIUS,
    y: WHEEL_RADIUS - Math.cos(rad) * WHEEL_RADIUS,
  }
}

const arcPathFromAngle = (angle: number): string => {
  const start = svgPointFromAngle(angle - GUIDE_ARC_SPAN / 2)
  const end = svgPointFromAngle(angle + GUIDE_ARC_SPAN / 2)

  return `M ${start.x.toFixed(3)} ${start.y.toFixed(3)} A ${WHEEL_RADIUS} ${WHEEL_RADIUS} 0 0 1 ${end.x.toFixed(3)} ${end.y.toFixed(3)}`
}

export default function AngleWheel({ value, label = 'Angle', onChange, onCommit }: TProps) {
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [angle, setAngle] = useState(() => normalizeAngle(value))
  const [dragging, setDragging] = useState(false)
  const s = useSalon()

  const pointStyle = pointFromAngle(angle)
  const guidePath = arcPathFromAngle(angle)

  useEffect(() => {
    setAngle(normalizeAngle(value))
  }, [value])

  const commitAngle = useCallback(
    (angle: number) => {
      setAngle(angle)
      onChange(angle)
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
    commitAngle(normalizeAngle(angle + (isIncrease ? 1 : -1)))
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
      aria-valuemin={0}
      aria-valuemax={359}
      aria-valuenow={angle}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <svg className={s.guide} viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`} aria-hidden='true'>
        <path className={s.guideArc} d={guidePath} strokeLinecap='round' />
      </svg>
      <button
        type='button'
        className={s.center}
        aria-label='Reset angle to 0 degrees'
        onMouseDown={handleResetMouseDown}
        onClick={handleResetClick}
      >
        {angle}°
      </button>
      <div className={s.point} style={pointStyle} />
    </div>
  )
}
