import { keys } from 'ramda'
import { useEffect, useMemo, useState } from 'react'

import CheckedSVG from '~/icons/CheckBold'
import { renderImageTextureDataUrl, renderTextureSwatchDataUrl } from '~/lib/wallpaperMesh'
import type { TImageTextureType, TWallpaperTexture } from '~/lib/wallpaperMesh'
import type { TWallpaperPic } from '~/spec'
import useWallpaperDomain from '~/stores/wallpaper/hooks'
import RangeInput from '~/widgets/RangeInput'

import useSalon, { cn } from '../salon/pictures_tab'
import useLogic from '../useLogic'

const TEXTURE_OPTIONS: { type: TImageTextureType; label: string }[] = [
  { type: 'grain', label: 'Grain' },
  { type: 'pixelate', label: 'Pixelate' },
  { type: 'screentone', label: 'Screentone' },
  { type: 'dither', label: 'Dither' },
]

const PREVIEW_RENDER_SIZE = {
  width: 760,
  height: 260,
}

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
  const s = useSalon()
  const [texture, setTexture] = useState<TWallpaperTexture>({ type: 'grain', strength: 45 })
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  const patternKeys = keys(patternWallpapers)
  const activeSource = source || patternKeys[0]
  const activeWallpaper = patternWallpapers[activeSource] as TWallpaperPic | undefined
  const activeImage = activeWallpaper?.image || activeWallpaper?.preview
  const textureSwatches = useMemo(
    () =>
      Object.fromEntries(
        TEXTURE_OPTIONS.map(({ type }) => [
          type,
          renderTextureSwatchDataUrl({
            texture: { type, strength: texture.strength },
          }),
        ]),
      ) as Record<TImageTextureType, string | null>,
    [texture.strength],
  )

  useEffect(() => {
    let disposed = false

    if (!activeImage) {
      setPreviewImage(null)
      commit?.({ customWallpaper: null })
      return
    }

    Promise.all([
      renderImageTextureDataUrl({
        imageUrl: activeImage,
        texture: texture.type,
        intensity: texture.strength,
        width: PREVIEW_RENDER_SIZE.width,
        height: PREVIEW_RENDER_SIZE.height,
        surface: 'preview',
      }),
      renderImageTextureDataUrl({
        imageUrl: activeImage,
        texture: texture.type,
        intensity: texture.strength,
        width: WALLPAPER_RENDER_SIZE.width,
        height: WALLPAPER_RENDER_SIZE.height,
        surface: 'wallpaper',
      }),
    ])
      .then(([previewDataUrl, wallpaperDataUrl]) => {
        if (disposed) return

        setPreviewImage(previewDataUrl)
        if (wallpaperDataUrl) {
          commit?.({
            customWallpaper: {
              image: wallpaperDataUrl,
              bgSize: 'cover',
            },
          })
        }
      })
      .catch(() => {
        if (!disposed) setPreviewImage(null)
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
        <div className={s.textureOptions}>
          {TEXTURE_OPTIONS.map(({ type, label }) => {
            const selected = texture.type === type

            return (
              <button
                type='button'
                key={type}
                className={cn(s.textureSwatch, selected && s.textureSwatchActive)}
                aria-label={label}
                onClick={() => updateTexture({ type })}
              >
                <div
                  className={s.textureSwatchPreview}
                  style={{
                    backgroundImage: textureSwatches[type]
                      ? `url(${textureSwatches[type]})`
                      : undefined,
                  }}
                />
              </button>
            )
          })}
        </div>

        <RangeInput
          value={texture.strength}
          min={0}
          max={100}
          step={1}
          valueLabel='Texture:'
          aria-label='Texture strength'
          onChange={(strength) => updateTexture({ strength })}
        />
      </div>

      <div
        className={s.texturePreview}
        style={{
          backgroundImage: previewImage
            ? `url(${previewImage})`
            : activeImage
              ? `url(${activeImage})`
              : undefined,
        }}
      />
    </div>
  )
}
