import { keys } from 'ramda'
import { useEffect, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import CheckedSVG from '~/icons/CheckBold'
import { WALLPAPER_TEXTURE_OPTIONS } from '~/lib/wallpaperMesh'
import type { TWallpaperTexture } from '~/lib/wallpaperMesh'
import type { TWallpaperPic } from '~/spec'
import RangeInput from '~/widgets/RangeInput'
import Tooltip from '~/widgets/Tooltip'

import useSalon, { cn } from '../salon/pictures_tab'
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
  const textureLabel = t('dsb.appearance.wallpaper.texture')
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
        <div className={s.textureRow}>
          <div className={s.textureLabel}>{textureLabel}</div>
          <div className={s.textureOptions}>
            {WALLPAPER_TEXTURE_OPTIONS.map(({ type, labelKey }) => {
              const selected = draftTexture.type === type
              const label = t(labelKey)

              return (
                <Tooltip key={type} content={label} placement='top'>
                  <button
                    type='button'
                    className={cn(
                      s.textureSwatch,
                      selected ? s.textureSwatchActive : s.textureSwatchIdle,
                    )}
                    aria-label={label}
                    onClick={() => updateTexture({ type })}
                  >
                    <div className={s.textureSwatchPreview} style={s.texturePatternStyle(type)} />
                  </button>
                </Tooltip>
              )
            })}
          </div>
        </div>

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
