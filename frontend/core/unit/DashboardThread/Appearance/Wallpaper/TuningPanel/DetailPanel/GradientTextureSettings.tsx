import { useEffect, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import type { TWallpaperTexture } from '~/lib/wallpaperMesh'
import RangeInput from '~/widgets/RangeInput'

import useSalon from '../../salon/tuning_panel/details_panel'
import TextureStylePicker from '../../TextureStylePicker'
import useLogic from '../../useLogic'

export default function GradientTextureSettings() {
  const s = useSalon()
  const { t } = useTrans()
  const { getWallpaper, changeTexture, flushWallpaperDraft } = useLogic()
  const { texture } = getWallpaper()
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
          ? 45
          : (patch.intensity ?? draftTexture.intensity),
    }

    setDraftTexture(nextTexture)
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
    <div className={s.texturePanel}>
      <div className={s.textureControls}>
        <TextureStylePicker
          value={draftTexture.type}
          onChange={(type) => updateTexture({ type })}
        />

        <div className={s.textureIntensity}>
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
      </div>
    </div>
  )
}
