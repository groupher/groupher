'use client'

import {
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import useSalon from '../salon/build_in/angle_panel'
import useLogic from '../useLogic'

const SIZE = 64
const RADIUS = SIZE / 2
const DOT_SIZE = 10
const DEFAULT_ANGLE = 180

const LEGACY_ANGLE = {
  top: 0,
  'top right': 45,
  right: 90,
  'bottom right': 135,
  bottom: 180,
  'bottom left': 225,
  left: 270,
  'top left': 315,
} as const

const normalizeAngle = (angle: number): number => Math.round(((angle % 360) + 360) % 360)

const parseAngle = (direction: string): number => {
  const direction$ = direction.trim().toLowerCase()

  if (direction$ in LEGACY_ANGLE) return LEGACY_ANGLE[direction$ as keyof typeof LEGACY_ANGLE]

  const match = direction$.match(/^(-?\d+(?:\.\d+)?)deg$/)
  if (!match) return DEFAULT_ANGLE

  return normalizeAngle(Number(match[1]))
}

const angleFromPointer = (clientX: number, clientY: number, rect: DOMRect): number => {
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const mathAngle = (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI

  return normalizeAngle(mathAngle + 90)
}

const pointFromAngle = (angle: number): { left: number; top: number } => {
  const rad = (angle * Math.PI) / 180
  const x = Math.sin(rad) * RADIUS
  const y = -Math.cos(rad) * RADIUS

  return {
    left: RADIUS + x - DOT_SIZE / 2,
    top: RADIUS + y - DOT_SIZE / 2,
  }
}

export default function AnglePanel() {
  const { getWallpaper, changeDirection } = useLogic()
  const { direction } = getWallpaper()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const [angle, setAngle] = useState(() => parseAngle(direction))
  const [dragging, setDragging] = useState(false)
  const s = useSalon()

  const pointStyle = pointFromAngle(angle)

  useEffect(() => {
    setAngle(parseAngle(direction))
  }, [direction])

  const commitAngle = useCallback(
    (angle: number) => {
      setAngle(angle)
      changeDirection(`${angle}deg`)
    },
    [changeDirection],
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
  }

  const handleMouseDown = (event: MouseEvent<HTMLDivElement>): void => {
    event.preventDefault()
    setDragging(true)
    updateAngle(event.clientX, event.clientY)
  }

  const handleClick = (event: MouseEvent<HTMLDivElement>): void => {
    updateAngle(event.clientX, event.clientY)
  }

  useEffect(() => {
    const node = panelRef.current
    if (!node) return

    const handleMouseDown = (event: globalThis.MouseEvent): void => {
      event.preventDefault()
      setDragging(true)
      updateAngle(event.clientX, event.clientY)
    }
    const handleClick = (event: globalThis.MouseEvent): void => {
      updateAngle(event.clientX, event.clientY)
    }

    node.addEventListener('mousedown', handleMouseDown)
    node.addEventListener('click', handleClick)

    return () => {
      node.removeEventListener('mousedown', handleMouseDown)
      node.removeEventListener('click', handleClick)
    }
  }, [updateAngle])

  useEffect(() => {
    if (!dragging) return

    const handleMouseMove = (event: globalThis.MouseEvent): void => {
      updateAngle(event.clientX, event.clientY)
    }
    const handleMouseUp = (event: globalThis.MouseEvent): void => {
      updateAngle(event.clientX, event.clientY)
      setDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging, updateAngle])

  return (
    <div
      ref={panelRef}
      className={s.wrapper}
      role='slider'
      tabIndex={0}
      aria-valuemin={0}
      aria-valuemax={359}
      aria-valuenow={angle}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className={s.center} onMouseDown={handleMouseDown} onClick={handleClick}>
        {angle}°
      </div>
      <div
        className={s.point}
        style={pointStyle}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      />
    </div>
  )
}
