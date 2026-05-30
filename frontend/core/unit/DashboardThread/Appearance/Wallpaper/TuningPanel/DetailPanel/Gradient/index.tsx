import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from 'react'

import { COLOR } from '~/const/colors'
import { cn } from '~/css'
import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'
import {
  GRADIENT_RENDERER,
  WALLPAPER_GRADIENT_RENDERER_OPTIONS,
  type TGradientRecipe,
  type TGradientRenderer,
} from '~/lib/wallpaperMesh'
import type { TColorName } from '~/spec'
import ColorSelector from '~/widgets/ColorSelector'
import RangeInput from '~/widgets/RangeInput'

import useSalon from '../../../salon/tuning_panel/detail_panel/gradient'
import useLogic from '../../../useLogic'
import AngleWheel from '../AngleWheel'
import GroupItem from '../GroupItem'
import GroupTitle from '../GroupTitle'
import {
  applyGradientSpreadValue,
  buildColorChips,
  findPresetColor,
  getGradientSpreadValue,
  resolvePresetColor,
} from './helper'

type Props = {
  gradient: TGradientRecipe | null
  canUseAngle: boolean
}

type TCenter = { x: number; y: number }

const clamp01 = (value: number): number => Math.min(1, Math.max(0, value))

function FocalPointControl({
  center,
  label,
  onChange,
  onCommit,
}: {
  center: TCenter
  label: string
  onChange: (center: TCenter) => void
  onCommit: () => void
}) {
  const panelRef = useRef<HTMLButtonElement | null>(null)
  const [draftCenter, setDraftCenter] = useState(center)
  const s = useSalon()

  useEffect(() => {
    setDraftCenter(center)
  }, [center])

  const updateCenter = (clientX: number, clientY: number): void => {
    const rect = panelRef.current?.getBoundingClientRect()
    if (!rect) return

    const nextCenter = {
      x: clamp01((clientX - rect.left) / rect.width),
      y: clamp01((clientY - rect.top) / rect.height),
    }

    setDraftCenter(nextCenter)
    onChange(nextCenter)
  }

  const handlePointerDown = (event: PointerEvent<HTMLButtonElement>): void => {
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    updateCenter(event.clientX, event.clientY)
  }
  const handlePointerMove = (event: PointerEvent<HTMLButtonElement>): void => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    updateCenter(event.clientX, event.clientY)
  }
  const handlePointerUp = (event: PointerEvent<HTMLButtonElement>): void => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      updateCenter(event.clientX, event.clientY)
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    onCommit()
  }
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>): void => {
    const delta = 0.03
    const nextCenter = {
      x: draftCenter.x,
      y: draftCenter.y,
    }

    if (event.key === 'ArrowLeft') nextCenter.x = clamp01(nextCenter.x - delta)
    else if (event.key === 'ArrowRight') nextCenter.x = clamp01(nextCenter.x + delta)
    else if (event.key === 'ArrowUp') nextCenter.y = clamp01(nextCenter.y - delta)
    else if (event.key === 'ArrowDown') nextCenter.y = clamp01(nextCenter.y + delta)
    else return

    event.preventDefault()
    setDraftCenter(nextCenter)
    onChange(nextCenter)
    onCommit()
  }

  return (
    <button
      type='button'
      ref={panelRef}
      className={s.focalPoint}
      aria-label={label}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={onCommit}
      onKeyDown={handleKeyDown}
    >
      <span className={s.focalPointVerticalLine} style={{ left: '33.333%' }} />
      <span className={s.focalPointVerticalLine} style={{ left: '66.667%' }} />
      <span className={s.focalPointHorizontalLine} style={{ top: '50%' }} />
      <span
        className={s.focalPointDot}
        style={{
          left: `${draftCenter.x * 100}%`,
          top: `${draftCenter.y * 100}%`,
        }}
      />
    </button>
  )
}

export default function Gradient({ gradient, canUseAngle }: Props) {
  const { t } = useTrans()
  const { theme } = useTheme()
  const {
    scheduleWallpaperPreview,
    flushWallpaperDraft,
    changeGradientRenderer,
    changeRadialCenter,
  } = useLogic()
  const s = useSalon()
  const [draftGradient, setDraftGradient] = useState<TGradientRecipe | null>(gradient)
  const activeGradient = draftGradient ?? gradient
  const spread = activeGradient ? getGradientSpreadValue(activeGradient) : 50
  const colorChips = activeGradient ? buildColorChips(activeGradient) : []
  const isRadial = activeGradient?.renderer === GRADIENT_RENDERER.RADIAL

  useEffect(() => {
    setDraftGradient(gradient)
  }, [gradient])

  const updateGradient = (nextGradient: TGradientRecipe, flush = false): void => {
    setDraftGradient(nextGradient)
    scheduleWallpaperPreview({ gradient: nextGradient })
    if (flush) flushWallpaperDraft()
  }

  const updateColor = (index: number, color: string): void => {
    if (!activeGradient) return

    updateGradient({
      ...activeGradient,
      colors: activeGradient.colors.map((value, valueIndex) =>
        valueIndex === index ? color : value,
      ),
    })
  }

  const updatePresetColor = (index: number, color: TColorName): void => {
    if (color === COLOR.CUSTOM) return
    updateColor(index, resolvePresetColor(color, theme))
  }

  const updateSpreadDraft = (value: number): void => {
    if (!activeGradient) return
    updateGradient(applyGradientSpreadValue(activeGradient, value))
  }

  const commitSpread = (value: number): void => {
    if (!activeGradient) return
    updateGradient(applyGradientSpreadValue(activeGradient, value), true)
  }
  const updateRenderer = (renderer: TGradientRenderer): void => {
    if (!activeGradient || renderer === activeGradient.renderer) return
    changeGradientRenderer(renderer)
  }
  const updateFocalPoint = (center: TCenter): void => {
    if (!activeGradient || activeGradient.renderer !== GRADIENT_RENDERER.RADIAL) return

    const nextGradient = {
      ...activeGradient,
      center,
    }
    setDraftGradient(nextGradient)
    changeRadialCenter(center)
  }

  if (!activeGradient) return null

  return (
    <section className={s.wrapper}>
      <GroupTitle>{t('dsb.appearance.wallpaper.editor.gradient')}</GroupTitle>

      <div className={s.items}>
        <GroupItem label={t('dsb.appearance.wallpaper.editor.colors')}>
          <div className={s.chips}>
            {colorChips.map(({ color, index, key }) => (
              <ColorSelector
                key={key}
                activeColor={findPresetColor(color, theme)}
                customColor={color}
                allowCustomColor
                placement='top'
                onChange={(selectedColor) => updatePresetColor(index, selectedColor)}
                onCustomColorChange={(customColor) => updateColor(index, customColor)}
              >
                <button
                  type='button'
                  className={s.chip}
                  style={{ backgroundColor: color }}
                  aria-label={`${t('dsb.appearance.wallpaper.editor.change_gradient_color')} ${
                    index + 1
                  }`}
                />
              </ColorSelector>
            ))}
          </div>
        </GroupItem>

        <GroupItem label={t('dsb.appearance.wallpaper.editor.renderer')} align='start'>
          <div className={s.renderers}>
            {WALLPAPER_GRADIENT_RENDERER_OPTIONS.map(({ renderer, labelKey }) => {
              const selected = activeGradient.renderer === renderer
              const label = t(labelKey)

              return (
                <button
                  type='button'
                  key={renderer}
                  className={cn(s.rendererButton, selected && s.rendererButtonActive)}
                  aria-pressed={selected}
                  onClick={() => updateRenderer(renderer)}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </GroupItem>

        <GroupItem label={t('dsb.appearance.wallpaper.editor.spread')}>
          <RangeInput
            value={spread}
            min={0}
            max={100}
            step={1}
            hideLabel
            valueLabel={t('dsb.appearance.wallpaper.editor.spread')}
            aria-label={t('dsb.appearance.wallpaper.editor.spread')}
            onChange={updateSpreadDraft}
            onChangeEnd={commitSpread}
          />
        </GroupItem>

        {isRadial && (
          <GroupItem label={t('dsb.appearance.wallpaper.editor.focal_point')} align='start'>
            <FocalPointControl
              center={activeGradient.center}
              label={t('dsb.appearance.wallpaper.editor.focal_point')}
              onChange={updateFocalPoint}
              onCommit={flushWallpaperDraft}
            />
          </GroupItem>
        )}

        {canUseAngle && !isRadial && (
          <GroupItem label={t('dsb.appearance.wallpaper.editor.direction')}>
            <div className={s.angle}>
              <AngleWheel />
            </div>
          </GroupItem>
        )}
      </div>
    </section>
  )
}
