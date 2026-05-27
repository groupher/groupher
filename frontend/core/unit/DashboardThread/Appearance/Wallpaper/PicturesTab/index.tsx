import { keys } from 'ramda'
import { useState } from 'react'

import useTrans from '~/hooks/useTrans'
import CheckedSVG from '~/icons/CheckBold'
import type { TImageTextureType, TWallpaperTexture } from '~/lib/wallpaperMesh'
import type { TWallpaperPic } from '~/spec'
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
  const { locale } = useTrans()
  const s = useSalon()
  const [draftTexture, setDraftTexture] = useState<TWallpaperTexture>({
    type: 'grain',
    strength: 45,
  })
  const textureLabel = locale === 'zh' || locale === 'zh-hant' ? '质感' : 'Texture'
  const intensityLabel = locale === 'zh' || locale === 'zh-hant' ? '强度' : 'Intensity'

  const updateTexture = (patch: Partial<TWallpaperTexture>): void => {
    const nextTexture = { ...draftTexture, ...patch }

    setDraftTexture(nextTexture)
  }

  const updateTextureStrengthDraft = (strength: number): void => {
    setDraftTexture((current) => ({ ...current, strength }))
  }

  const commitTextureStrength = (strength: number): void => {
    const nextTexture = { ...draftTexture, strength }

    setDraftTexture(nextTexture)
  }

  return (
    <div className={s.texturePanel}>
      <div className={s.textureControls}>
        <div className={s.textureRow}>
          <div className={s.textureLabel}>{textureLabel}</div>
          <div className={s.textureOptions}>
            {TEXTURE_OPTIONS.map(({ type, label }) => {
              const selected = draftTexture.type === type

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
            value={draftTexture.strength}
            min={0}
            max={100}
            step={1}
            labelPlacement='left'
            valueLabel={intensityLabel}
            aria-label={intensityLabel}
            onChange={updateTextureStrengthDraft}
            onChangeEnd={commitTextureStrength}
          />
        </div>
      </div>
    </div>
  )
}
