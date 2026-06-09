import { useEffect, useState } from 'react'

import { COLOR } from '~/const/colors'
import { cn } from '~/css'
import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'
import {
  buildColorChips,
  findPresetColor,
  getGradientSpreadValue,
  resolvePresetColor,
  applyGradientSpreadValue,
} from '~/lib/bg/gradient'
import {
  GRADIENT_RENDERER,
  WALLPAPER_GRADIENT_RENDERER_OPTIONS,
  type TGradientRecipe,
  type TGradientRenderer,
} from '~/lib/wallpaperMesh'
import type { TColorName } from '~/spec'
import ColorSelector from '~/widgets/ColorSelector'
import FocalPointControl, { type TPoint } from '~/widgets/FocalPointControl'
import RangeInput from '~/widgets/RangeInput'

import useLogic from '../../../useLogic'
import useSalon from '../../salon/detail_panel/gradient'
import AngleWheel from '../AngleWheel'
import GroupItem from '../GroupItem'
import GroupTitle from '../GroupTitle'

type Props = {
  gradient: TGradientRecipe | null
  canUseAngle: boolean
}

export default function Gradient({ gradient, canUseAngle }: Props) {
  const { t } = useTrans()
  const { theme } = useTheme()
  const { scheduleWallpaperPreview, flushWallpaperDraft, changeGradientRenderer } = useLogic()
  const s = useSalon()
  const [draftGradient, setDraftGradient] = useState<TGradientRecipe | null>(gradient)
  const activeGradient = draftGradient ?? gradient
  const spread = activeGradient ? getGradientSpreadValue(activeGradient) : 50
  const colorChips = activeGradient ? buildColorChips(activeGradient) : []

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
  const updateFocalPoint = (center: TPoint): void => {
    if (!activeGradient || activeGradient.renderer !== GRADIENT_RENDERER.RADIAL) return

    const nextGradient = {
      ...activeGradient,
      center,
    }
    setDraftGradient(nextGradient)
    scheduleWallpaperPreview({ gradient: nextGradient })
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

        {activeGradient.renderer === GRADIENT_RENDERER.RADIAL && (
          <GroupItem label={t('dsb.appearance.wallpaper.editor.focal_point')} align='start'>
            <FocalPointControl
              value={activeGradient.center}
              label={t('dsb.appearance.wallpaper.editor.focal_point')}
              onChange={updateFocalPoint}
              onCommit={flushWallpaperDraft}
            />
          </GroupItem>
        )}

        {canUseAngle && activeGradient.renderer !== GRADIENT_RENDERER.RADIAL && (
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
