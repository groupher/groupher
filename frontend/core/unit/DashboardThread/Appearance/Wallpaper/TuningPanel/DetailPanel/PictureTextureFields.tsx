import { useState } from 'react'

import useTrans from '~/hooks/useTrans'
import { DEFAULT_WALLPAPER_TEXTURE_INTENSITY, type TWallpaperTexture } from '~/lib/wallpaperMesh'
import RangeInput from '~/widgets/RangeInput'

import useSalon from '../../salon/tuning_panel/details_panel/picture_texture_fields'
import TextureStylePicker from '../../TextureStylePicker'
import useLogic from '../../useLogic'

export default function PictureTextureFields() {
  const { t } = useTrans()
  const s = useSalon()
  const { getWallpaper, toggleTexture, changeTexture, flushWallpaperDraft } = useLogic()
  const { hasTexture, texture } = getWallpaper()
  const [draftTexture, setDraftTexture] = useState<TWallpaperTexture | null>(null)
  const activeTexture = draftTexture ?? texture
  const intensityLabel = t('dsb.appearance.wallpaper.texture.intensity')

  const updateTexture = (patch: Partial<TWallpaperTexture>): void => {
    const nextTexture = {
      ...activeTexture,
      ...patch,
      intensity:
        patch.type && activeTexture.intensity === 0
          ? DEFAULT_WALLPAPER_TEXTURE_INTENSITY
          : (patch.intensity ?? activeTexture.intensity),
    }

    if (!hasTexture) toggleTexture(true)
    changeTexture(nextTexture)
    flushWallpaperDraft()
    setDraftTexture(null)
  }

  const updateTextureIntensityDraft = (intensity: number): void => {
    const nextTexture = { ...activeTexture, intensity }

    setDraftTexture(nextTexture)
    changeTexture(nextTexture)
  }

  const commitTextureIntensity = (intensity: number): void => {
    const nextTexture = { ...activeTexture, intensity }

    changeTexture(nextTexture)
    flushWallpaperDraft()
    setDraftTexture(null)
  }

  return (
    <div className={s.wrapper}>
      <div className={s.controls}>
        <TextureStylePicker
          value={activeTexture.type}
          active={hasTexture}
          onChange={(type) => updateTexture({ type })}
        />

        {hasTexture && (
          <div className={s.intensity}>
            <RangeInput
              value={activeTexture.intensity}
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
