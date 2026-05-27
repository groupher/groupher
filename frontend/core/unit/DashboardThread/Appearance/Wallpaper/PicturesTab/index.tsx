import { keys } from 'ramda'
import { useEffect, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import CheckedSVG from '~/icons/CheckBold'
import { renderImageTextureDataUrl } from '~/lib/wallpaperMesh'
import type { TImageTextureType, TWallpaperTexture } from '~/lib/wallpaperMesh'
import type { TWallpaperPic } from '~/spec'
import useWallpaperDomain from '~/stores/wallpaper/hooks'
import RangeInput from '~/widgets/RangeInput'
import Tooltip from '~/widgets/Tooltip'

import useSalon, { cn } from '../salon/pictures_tab'
import useLogic from '../useLogic'

const TEXTURE_OPTIONS: { type: TImageTextureType; label: string }[] = [
  { type: 'grain', label: 'Grain' },
  { type: 'pixelate', label: 'Pixelate' },
  { type: 'screentone', label: 'Screentone' },
  { type: 'dither', label: 'Dither' },
]

const WALLPAPER_RENDER_SIZE = {
  width: 1920,
  height: 1080,
}

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
  const { getWallpaper } = useLogic()
  const { source, patternWallpapers } = getWallpaper()
  const { commit } = useWallpaperDomain()
  const { locale } = useTrans()
  const s = useSalon()
  const [texture, setTexture] = useState<TWallpaperTexture>({ type: 'grain', strength: 45 })
  const textureLabel = locale === 'zh' || locale === 'zh-hant' ? '质感' : 'Texture'
  const intensityLabel = locale === 'zh' || locale === 'zh-hant' ? '强度' : 'Intensity'

  const patternKeys = keys(patternWallpapers)
  const activeSource = source || patternKeys[0]
  const activeWallpaper = patternWallpapers[activeSource] as TWallpaperPic | undefined
  const activeImage = activeWallpaper?.image || activeWallpaper?.preview

  useEffect(() => {
    let disposed = false

    if (!activeImage) {
      commit?.({ customWallpaper: null })
      return
    }

    renderImageTextureDataUrl({
      imageUrl: activeImage,
      texture: texture.type,
      intensity: texture.strength,
      width: WALLPAPER_RENDER_SIZE.width,
      height: WALLPAPER_RENDER_SIZE.height,
      surface: 'wallpaper',
    })
      .then((wallpaperDataUrl) => {
        if (disposed || !wallpaperDataUrl) return

        commit?.({
          customWallpaper: {
            image: wallpaperDataUrl,
            bgSize: 'cover',
          },
        })
      })
      .catch(() => {
        if (!disposed) {
          commit?.({
            customWallpaper: {
              image: activeImage,
              bgSize: 'cover',
            },
          })
        }
      })

    return () => {
      disposed = true
    }
  }, [activeImage, commit, texture])

  const updateTexture = (patch: Partial<TWallpaperTexture>): void => {
    setTexture((current) => ({ ...current, ...patch }))
  }

  return (
    <div className={s.texturePanel}>
      <div className={s.textureControls}>
        <div className={s.textureRow}>
          <div className={s.textureLabel}>{textureLabel}</div>
          <div className={s.textureOptions}>
            {TEXTURE_OPTIONS.map(({ type, label }) => {
              const selected = texture.type === type

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

        <div className={s.textureStrength}>
          <RangeInput
            value={texture.strength}
            min={0}
            max={100}
            step={1}
            labelPlacement='left'
            valueLabel={intensityLabel}
            aria-label={intensityLabel}
            onChange={(strength) => updateTexture({ strength })}
          />
        </div>
      </div>
    </div>
  )
}
