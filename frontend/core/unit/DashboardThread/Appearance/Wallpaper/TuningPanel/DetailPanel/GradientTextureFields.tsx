import { useEffect, useState } from 'react'

import { COLOR, RAINBOW_COLOR_HEX } from '~/const/colors'
import useTheme from '~/hooks/useTheme'
import useTrans from '~/hooks/useTrans'
import {
  DEFAULT_WALLPAPER_TEXTURE_INTENSITY,
  GRADIENT_TYPE,
  type TGradientRecipe,
  type TWallpaperTexture,
} from '~/lib/wallpaperMesh'
import type { TColorName } from '~/spec'
import ColorSelector from '~/widgets/ColorSelector'
import RangeInput from '~/widgets/RangeInput'

import useSalon from '../../salon/tuning_panel/details_panel/gradient_texture_fields'
import TextureStylePicker from '../../TextureStylePicker'
import useLogic from '../../useLogic'

const findPresetColor = (color: string, theme: keyof typeof RAINBOW_COLOR_HEX): TColorName => {
  const match = Object.entries(RAINBOW_COLOR_HEX[theme]).find(([, value]) => value === color)

  return (match?.[0] as TColorName | undefined) ?? COLOR.CUSTOM
}

const resolvePresetColor = (color: TColorName, theme: keyof typeof RAINBOW_COLOR_HEX): string =>
  RAINBOW_COLOR_HEX[theme][color] ?? RAINBOW_COLOR_HEX[theme][COLOR.BLACK]

const buildColorChips = (
  gradient: TGradientRecipe,
): Array<{ color: string; index: number; key: string }> => {
  const colorCounts = new Map<string, number>()

  return gradient.colors.map((color, index) => {
    const count = (colorCounts.get(color) ?? 0) + 1
    colorCounts.set(color, count)

    return {
      color,
      index,
      key: `${gradient.preset}-${color}-${count}`,
    }
  })
}

const getGradientSpreadValue = (gradient: TGradientRecipe): number =>
  gradient.kind === GRADIENT_TYPE.MESH ? gradient.softness : gradient.spread

const applyGradientSpreadValue = (gradient: TGradientRecipe, spread: number): TGradientRecipe => {
  if (gradient.kind === GRADIENT_TYPE.MESH) {
    // Mesh models share the user-facing Spread control, but each renderer may
    // interpret softness differently. FLOW maps it to strand density/curvature.
    return {
      ...gradient,
      softness: spread,
    }
  }

  return { ...gradient, spread }
}

export default function GradientTextureFields() {
  const s = useSalon()
  const { t } = useTrans()
  const { theme } = useTheme()
  const {
    getWallpaper,
    scheduleWallpaperPreview,
    toggleTexture,
    changeTexture,
    flushWallpaperDraft,
  } = useLogic()
  const { hasTexture, gradient, texture } = getWallpaper()
  const [draftTexture, setDraftTexture] = useState<TWallpaperTexture>({
    ...texture,
  })
  const [draftGradient, setDraftGradient] = useState<TGradientRecipe | null>(gradient)
  const activeGradient = draftGradient ?? gradient
  const spread = activeGradient ? getGradientSpreadValue(activeGradient) : 50
  const intensityLabel = t('dsb.appearance.wallpaper.texture.intensity')
  const colorChips = activeGradient ? buildColorChips(activeGradient) : []

  useEffect(() => {
    setDraftTexture(texture)
  }, [texture])

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

  const updateTexture = (patch: Partial<TWallpaperTexture>): void => {
    const nextTexture = {
      ...draftTexture,
      ...patch,
      intensity:
        patch.type && draftTexture.intensity === 0
          ? DEFAULT_WALLPAPER_TEXTURE_INTENSITY
          : (patch.intensity ?? draftTexture.intensity),
    }

    setDraftTexture(nextTexture)
    if (!hasTexture) toggleTexture(true)
    changeTexture(nextTexture)
    flushWallpaperDraft()
  }

  const updateTextureIntensityDraft = (intensity: number): void => {
    const nextTexture = { ...draftTexture, intensity }

    setDraftTexture(nextTexture)
    changeTexture(nextTexture)
  }

  const commitTextureIntensity = (intensity: number): void => {
    const nextTexture = { ...draftTexture, intensity }

    setDraftTexture(nextTexture)
    changeTexture(nextTexture)
    flushWallpaperDraft()
  }

  return (
    <div className={s.wrapper}>
      <div className={s.controls}>
        <TextureStylePicker
          value={draftTexture.type}
          active={hasTexture}
          onChange={(type) => updateTexture({ type })}
        />

        {activeGradient && (
          <>
            <div className={s.panel}>
              <div className={s.label}>Colors</div>
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
                      aria-label={`Change gradient color ${index + 1}`}
                    />
                  </ColorSelector>
                ))}
              </div>
            </div>

            <RangeInput
              value={spread}
              min={0}
              max={100}
              step={1}
              labelPlacement='left'
              valueLabel='Spread'
              aria-label='Spread'
              onChange={updateSpreadDraft}
              onChangeEnd={commitSpread}
            />
          </>
        )}

        {hasTexture && (
          <div className={s.intensity}>
            <RangeInput
              value={draftTexture.intensity}
              min={0}
              max={100}
              step={1}
              labelPlacement='left'
              valueLabel={intensityLabel}
              aria-label={intensityLabel}
              onChange={updateTextureIntensityDraft}
              onChangeEnd={commitTextureIntensity}
            />
          </div>
        )}
      </div>
    </div>
  )
}
