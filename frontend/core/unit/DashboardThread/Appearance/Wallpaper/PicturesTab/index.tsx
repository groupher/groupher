import { keys } from 'ramda'
import { useEffect, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import CheckedSVG from '~/icons/CheckBold'
import type { TWallpaperTexture } from '~/lib/wallpaperMesh'
import type { TWallpaperPic } from '~/spec'
import RangeInput from '~/widgets/RangeInput'

import useSalon, { cn } from '../salon/pictures_tab'
import TextureStylePicker from '../TextureStylePicker'
import useLogic from '../useLogic'

export default function PicturesTab() {
  const { getWallpaper, changePatternWallpaper } = useLogic()
  const { source, patternWallpapers } = getWallpaper()

  const s = useSalon()

  const patternKeys = keys(patternWallpapers)

  return (
    <div className={s.wrapper}>
      {patternKeys.map((name) => {
        const { image, preview } = patternWallpapers[name] as TWallpaperPic

        return (
          <button
            type='button'
            className={cn(s.block, name === source && s.blockActive)}
            key={name}
            onClick={() => changePatternWallpaper(name)}
          >
            {name === source && (
              <div className={s.activeSign}>
                <CheckedSVG className={s.checkIcon} />
              </div>
            )}
            <img className={s.image} src={preview ?? image} alt='' />
          </button>
        )
      })}
    </div>
  )
}

export function PictureTextureSettings() {
  const { t } = useTrans()
  const s = useSalon()
  const { getWallpaper, changeTexture, flushWallpaperDraft } = useLogic()
  const { texture } = getWallpaper()
  const [draftTexture, setDraftTexture] = useState<TWallpaperTexture>({
    ...texture,
  })
  const intensityLabel = t('dsb.appearance.wallpaper.texture.intensity')

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
            valueLabel={intensityLabel}
            aria-label={intensityLabel}
            onChange={updateTextureIntensityDraft}
            onChangeEnd={commitTextureIntensity}
          />
        </div>
      </div>
    </div>
  )
}
