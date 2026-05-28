import { useEffect, useMemo, useState } from 'react'

import { WALLPAPER_TYPE } from '~/const/wallpaper'
import useTrans from '~/hooks/useTrans'
import {
  DEFAULT_WALLPAPER_TEXTURE_INTENSITY,
  type TMeshGradientRecipe,
  type TWallpaperTexture,
} from '~/lib/wallpaperMesh'
import RangeInput from '~/widgets/RangeInput'

import { getInitialRecipe } from '../../../DiyTab'
import useSalon from '../../../salon/tuning_panel/details_panel/diy_fields'
import TextureStylePicker from '../../../TextureStylePicker'
import useLogic from '../../../useLogic'

export default function DiyFields() {
  const s = useSalon()
  const {
    getWallpaper,
    scheduleWallpaperPreview,
    flushWallpaperDraft,
    toggleTexture,
    changeTexture,
  } = useLogic()
  const { hasTexture, mesh, texture } = getWallpaper()
  const { t } = useTrans()
  const sourceRecipe = useMemo(() => getInitialRecipe(mesh), [mesh])
  const [draftRecipe, setDraftRecipe] = useState(sourceRecipe)
  const [draftTexture, setDraftTexture] = useState(texture)
  const intensityLabel = t('dsb.appearance.wallpaper.texture.intensity')

  useEffect(() => {
    setDraftRecipe(sourceRecipe)
  }, [sourceRecipe])

  useEffect(() => {
    setDraftTexture(texture)
  }, [texture])

  const commitRecipe = (nextRecipe: TMeshGradientRecipe, flush = false): void => {
    scheduleWallpaperPreview({
      source: '',
      type: WALLPAPER_TYPE.MESH,
      mesh: nextRecipe,
    })

    if (flush) flushWallpaperDraft()
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

  const updateColor = (index: number, color: string): void => {
    const nextRecipe = {
      ...draftRecipe,
      colors: draftRecipe.colors.map((value, valueIndex) => (valueIndex === index ? color : value)),
    }

    setDraftRecipe(nextRecipe)
    commitRecipe(nextRecipe)
  }

  const updateSoftnessDraft = (softness: number): void => {
    const nextRecipe = { ...draftRecipe, softness }

    setDraftRecipe(nextRecipe)
    commitRecipe(nextRecipe)
  }

  const commitSoftness = (softness: number): void => {
    const nextRecipe = { ...draftRecipe, softness }

    setDraftRecipe(nextRecipe)
    commitRecipe(nextRecipe, true)
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
        <div className={s.panel}>
          <div className={s.label}>Colors</div>
          <div className={s.chips}>
            {draftRecipe.colors.map((color, index) => (
              <label
                key={`${color}-${draftRecipe.anchors[index]?.x}-${draftRecipe.anchors[index]?.y}`}
                className={s.chip}
                style={{ background: color }}
                aria-label={`Change color ${index + 1}`}
              >
                <input
                  className={s.colorInput}
                  type='color'
                  value={color}
                  onChange={(event) => updateColor(index, event.target.value)}
                />
              </label>
            ))}
          </div>
        </div>

        <div className={s.rangeGroup}>
          <RangeInput
            value={draftRecipe.softness}
            min={0}
            max={100}
            step={1}
            labelPlacement='left'
            valueLabel='Spread'
            aria-label='Spread'
            onChange={updateSoftnessDraft}
            onChangeEnd={commitSoftness}
          />
          <div className={s.textureControl}>
            <TextureStylePicker
              value={draftTexture.type}
              active={hasTexture}
              onChange={(type) => updateTexture({ type })}
            />
            {hasTexture && (
              <div className={s.textureIntensity}>
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
      </div>
    </div>
  )
}
