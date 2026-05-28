import { useEffect, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import { DEFAULT_WALLPAPER_TEXTURE_INTENSITY, type TWallpaperTexture } from '~/lib/wallpaperMesh'
import RangeInput from '~/widgets/RangeInput'

import useSalon from '../../salon/tuning_panel/details_panel/gradient_texture_fields'
import TextureStylePicker from '../../TextureStylePicker'
import useLogic from '../../useLogic'

export default function GradientTextureFields() {
  const s = useSalon()
  const { t } = useTrans()
  const { getWallpaper, toggleTexture, changeTexture, flushWallpaperDraft } = useLogic()
  const { hasTexture, texture } = getWallpaper()
  const [draftTexture, setDraftTexture] = useState<TWallpaperTexture>({
    ...texture,
  })

  useEffect(() => {
    setDraftTexture(texture)
  }, [texture])

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

        {hasTexture && (
          <div className={s.intensity}>
            <RangeInput
              value={draftTexture.intensity}
              min={0}
              max={100}
              step={1}
              labelPlacement='left'
              valueLabel={t('dsb.appearance.wallpaper.texture.intensity')}
              aria-label={t('dsb.appearance.wallpaper.texture.intensity')}
              onChange={updateTextureIntensityDraft}
              onChangeEnd={commitTextureIntensity}
            />
          </div>
        )}
      </div>
    </div>
  )
}
