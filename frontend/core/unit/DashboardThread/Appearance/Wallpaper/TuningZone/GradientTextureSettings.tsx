import { keys } from 'ramda'
import { useEffect, useState } from 'react'

import { renderGradientTextureDataUrl } from '~/lib/wallpaperMesh'
import type { TImageTextureType, TWallpaperTexture } from '~/lib/wallpaperMesh'
import type { TWallpaperGradient } from '~/spec'
import useWallpaperDomain from '~/stores/wallpaper/hooks'
import RangeInput from '~/widgets/RangeInput'
import Tooltip from '~/widgets/Tooltip'

import useSalon, { cn } from '../salon/tuning_zone'
import useLogic from '../useLogic'

const TEXTURE_OPTIONS: { type: TImageTextureType; label: string }[] = [
  { type: 'grain', label: 'Grain' },
  { type: 'pixelate', label: 'Pixelate' },
  { type: 'screentone', label: 'Screentone' },
  { type: 'dither', label: 'Dither' },
]

export default function GradientTextureSettings() {
  const { getWallpaper } = useLogic()
  const { source, direction, hasPattern, gradientWallpapers } = getWallpaper()
  const { commit } = useWallpaperDomain()
  const s = useSalon()
  const [texture, setTexture] = useState<TWallpaperTexture>({ type: 'grain', strength: 45 })

  const gradientKeys = keys(gradientWallpapers)
  const activeSource = source || gradientKeys[0]
  const activeGradient = gradientWallpapers[activeSource] as TWallpaperGradient | undefined
  const activeColors = activeGradient?.colors || []
  const activeColorsKey = activeColors.join(',')

  useEffect(() => {
    let disposed = false

    if (!activeColorsKey) {
      commit?.({ customWallpaper: null })
      return
    }

    renderGradientTextureDataUrl({
      colors: activeColorsKey.split(','),
      direction,
      hasPattern,
      texture: texture.type,
      intensity: texture.strength,
    }).then((wallpaperDataUrl) => {
      if (disposed || !wallpaperDataUrl) return

      commit?.({
        customWallpaper: {
          image: wallpaperDataUrl,
          bgSize: 'cover',
        },
      })
    })

    return () => {
      disposed = true
    }
  }, [activeColorsKey, commit, direction, hasPattern, texture])

  const updateTexture = (patch: Partial<TWallpaperTexture>): void => {
    setTexture((current) => ({ ...current, ...patch }))
  }

  return (
    <div className={s.texturePanel}>
      <div className={s.textureControls}>
        <div className={s.textureRow}>
          <div className={s.textureLabel}>Texture</div>
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
            valueLabel='Intensity'
            aria-label='Intensity'
            onChange={(strength) => updateTexture({ strength })}
          />
        </div>
      </div>
    </div>
  )
}
