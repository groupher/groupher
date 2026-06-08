import { type PointerEvent, useRef } from 'react'

import SettingSVG from '~/icons/Setting'
import RangeInput from '~/widgets/RangeInput'
import Tooltip from '~/widgets/Tooltip'

import {
  MAGNIFIER_APPEARANCE_DEFAULT,
  MAGNIFIER_BORDER_COLOR,
  MAGNIFIER_BORDER_WIDTH_RANGE,
  MAGNIFIER_SHADOW_RANGE,
} from '../../../../constant'
import {
  normalizeMagnifierAppearance,
  normalizeMagnifierBorderWidth,
  normalizeMagnifierHighlightIntensity,
  normalizeMagnifierShadow,
} from '../../../../helper'
import type { TCoverPoint, TMagnifierAppearance, TMagnifierBorderColor } from '../../../../spec'
import useLogic from '../../../../useLogic'
import useSalon, { cn } from './salon/settings'

type TProps = {
  appearance: TMagnifierAppearance
}

type TColorOption = {
  label: string
  value: TMagnifierBorderColor
}

type TLightControlValue = {
  center: TCoverPoint
  radius: number
}

type TLightDragMode = 'center' | 'radius'

const COLOR_OPTIONS: TColorOption[] = [
  { label: 'Gray border', value: MAGNIFIER_BORDER_COLOR.GRAY },
  { label: 'Black border', value: MAGNIFIER_BORDER_COLOR.BLACK },
]

const LIGHT_CONTROL = {
  circleCenter: 0.5,
  circleRadius: 0.5,
  centerHitRadius: 0.15,
  handleHitRadius: 0.1,
  dragThreshold: 0.03,
  minHandleDistance: 0.15,
  maxHandleDistance: 0.3,
} as const

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

const getDistance = (a: TCoverPoint, b: TCoverPoint): number => {
  const dx = a.x - b.x
  const dy = a.y - b.y

  return Math.sqrt(dx * dx + dy * dy)
}

const getConstrainedPoint = (point: TCoverPoint): TCoverPoint => {
  const dx = point.x - LIGHT_CONTROL.circleCenter
  const dy = point.y - LIGHT_CONTROL.circleCenter
  const distance = Math.sqrt(dx * dx + dy * dy)

  if (distance <= LIGHT_CONTROL.circleRadius) {
    return {
      x: clamp01(point.x),
      y: clamp01(point.y),
    }
  }

  const ratio = LIGHT_CONTROL.circleRadius / distance

  return {
    x: LIGHT_CONTROL.circleCenter + dx * ratio,
    y: LIGHT_CONTROL.circleCenter + dy * ratio,
  }
}

const getPointFromPointer = (event: PointerEvent<HTMLButtonElement>): TCoverPoint => {
  const rect = event.currentTarget.getBoundingClientRect()

  return getConstrainedPoint({
    x: (event.clientX - rect.left) / rect.width,
    y: (event.clientY - rect.top) / rect.height,
  })
}

const getMaxHandleDistance = (center: TCoverPoint): number => {
  const dy = center.y - LIGHT_CONTROL.circleCenter
  const rightEdgeDistance =
    LIGHT_CONTROL.circleCenter +
    Math.sqrt(Math.max(0, LIGHT_CONTROL.circleRadius ** 2 - dy * dy)) -
    center.x

  return Math.max(LIGHT_CONTROL.minHandleDistance, rightEdgeDistance)
}

const getHandleDistance = (value: TLightControlValue): number =>
  Math.min(
    LIGHT_CONTROL.minHandleDistance +
      clamp01(value.radius) * (LIGHT_CONTROL.maxHandleDistance - LIGHT_CONTROL.minHandleDistance),
    getMaxHandleDistance(value.center),
  )

const getRadiusHandlePoint = (value: TLightControlValue): TCoverPoint => ({
  x: value.center.x + getHandleDistance(value),
  y: value.center.y,
})

const getRadiusFromPoint = (point: TCoverPoint, center: TCoverPoint): number => {
  const projectedDistance = Math.max(
    LIGHT_CONTROL.minHandleDistance,
    Math.min(point.x - center.x, getMaxHandleDistance(center)),
  )

  return clamp01(
    (projectedDistance - LIGHT_CONTROL.minHandleDistance) /
      (LIGHT_CONTROL.maxHandleDistance - LIGHT_CONTROL.minHandleDistance),
  )
}

function LightControl({
  value,
  label,
  onChange,
}: {
  value: TLightControlValue
  label: string
  onChange: (value: TLightControlValue) => void
}) {
  const s = useSalon()
  const dragModeRef = useRef<TLightDragMode | null>(null)
  const pointerStartRef = useRef<TCoverPoint | null>(null)
  const hasDraggedRef = useRef(false)
  const handlePoint = getRadiusHandlePoint(value)
  const guideWidth = Math.max(0, handlePoint.x - value.center.x)

  const updateFromPoint = (point: TCoverPoint, mode: TLightDragMode): void => {
    if (mode === 'radius') {
      onChange({
        ...value,
        radius: getRadiusFromPoint(point, value.center),
      })
      return
    }

    onChange({
      ...value,
      center: getConstrainedPoint(point),
    })
  }

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>): void => {
    const point = getPointFromPointer(event)
    const mode =
      getDistance(point, handlePoint) <= LIGHT_CONTROL.handleHitRadius
        ? 'radius'
        : getDistance(point, value.center) <= LIGHT_CONTROL.centerHitRadius
          ? 'center'
          : 'center'

    event.preventDefault()
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragModeRef.current = mode
    pointerStartRef.current = point
    hasDraggedRef.current = false

    if (mode === 'radius') updateFromPoint(point, mode)
  }

  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>): void => {
    const mode = dragModeRef.current
    if (!mode || !event.currentTarget.hasPointerCapture(event.pointerId)) return

    const point = getPointFromPointer(event)
    const startPoint = pointerStartRef.current

    if (startPoint && getDistance(point, startPoint) > LIGHT_CONTROL.dragThreshold) {
      hasDraggedRef.current = true
    }

    updateFromPoint(point, mode)
  }

  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>): void => {
    const mode = dragModeRef.current

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    if (mode === 'center' && !hasDraggedRef.current) {
      onChange({
        ...value,
        radius:
          value.radius > 0
            ? 0
            : normalizeMagnifierHighlightIntensity(
                MAGNIFIER_APPEARANCE_DEFAULT.HIGHLIGHT_INTENSITY,
              ),
      })
    }

    dragModeRef.current = null
    pointerStartRef.current = null
    hasDraggedRef.current = false
  }

  return (
    <button
      type='button'
      className={s.lightControl}
      aria-label={label}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <span className={s.lightGridLineV} />
      <span className={s.lightGridLineH} />
      <span
        className={s.lightGuide}
        style={{
          left: `${value.center.x * 100}%`,
          top: `${value.center.y * 100}%`,
          width: `${guideWidth * 100}%`,
        }}
      />
      <span
        className={s.lightCenterGlow}
        style={{ left: `${value.center.x * 100}%`, top: `${value.center.y * 100}%` }}
      />
      <span
        className={s.lightCenter}
        style={{ left: `${value.center.x * 100}%`, top: `${value.center.y * 100}%` }}
      />
      <span
        className={s.lightHandle}
        style={{ left: `${handlePoint.x * 100}%`, top: `${handlePoint.y * 100}%` }}
      />
    </button>
  )
}

export default function MagnifierSettings({ appearance }: TProps) {
  const s = useSalon()
  const { magnifierAppearanceOnChange } = useLogic()
  const normalized = normalizeMagnifierAppearance(appearance)

  return (
    <Tooltip
      placement='right'
      trigger='click'
      hideOnClick={false}
      maxWidth='none'
      offset={[8, 0]}
      portalToBody
      content={
        <div className={s.panel}>
          <div className={s.lightFieldRow}>
            <span className={s.lightFieldLabel}>Light</span>
            <LightControl
              value={{
                center: normalized.highlightCenter,
                radius: normalized.highlightIntensity,
              }}
              label='Magnifier highlight'
              onChange={(nextValue) =>
                magnifierAppearanceOnChange({
                  highlightCenter: nextValue.center,
                  highlightIntensity: normalizeMagnifierHighlightIntensity(nextValue.radius),
                })
              }
            />
          </div>

          <div className={s.fieldRow}>
            <span className={s.fieldLabel}>Border</span>
            <div className={s.borderFields}>
              <div className={s.colorRow}>
                {COLOR_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type='button'
                    className={cn(
                      s.colorButton,
                      option.value === MAGNIFIER_BORDER_COLOR.GRAY
                        ? s.grayColorButton
                        : s.blackColorButton,
                      normalized.borderColor === option.value && s.colorButtonActive,
                    )}
                    aria-label={option.label}
                    aria-pressed={normalized.borderColor === option.value}
                    onClick={() => magnifierAppearanceOnChange({ borderColor: option.value })}
                  />
                ))}
              </div>
              <RangeInput
                value={normalized.borderWidth}
                min={MAGNIFIER_BORDER_WIDTH_RANGE.MIN}
                max={MAGNIFIER_BORDER_WIDTH_RANGE.MAX}
                step={1}
                width='w-full'
                valueLabel='Magnifier border width'
                aria-label='Magnifier border width'
                hideLabel
                unit='px'
                onChange={(nextValue) =>
                  magnifierAppearanceOnChange({
                    borderWidth: normalizeMagnifierBorderWidth(nextValue),
                  })
                }
              />
            </div>
          </div>

          <div className={s.fieldRow}>
            <span className={s.fieldLabel}>Shadow</span>
            <RangeInput
              value={normalized.shadow}
              min={MAGNIFIER_SHADOW_RANGE.MIN}
              max={MAGNIFIER_SHADOW_RANGE.MAX}
              step={1}
              width='w-full'
              valueLabel='Magnifier shadow'
              aria-label='Magnifier shadow intensity'
              hideLabel
              unit='%'
              onChange={(nextValue) =>
                magnifierAppearanceOnChange({
                  shadow: normalizeMagnifierShadow(nextValue),
                })
              }
            />
          </div>
        </div>
      }
    >
      <button type='button' className={s.settingButton} aria-label='Magnifier settings'>
        <SettingSVG className={s.settingIcon} />
      </button>
    </Tooltip>
  )
}
