import { useEffect, useState } from 'react'

import type { TImageTextureType, TWallpaperTexture } from '~/lib/wallpaperMesh'
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
  const s = useSalon()
  const { getWallpaper, changeTexture, flushWallpaperDraft } = useLogic()
  const { textureType, textureStrength } = getWallpaper()
  const [draftTexture, setDraftTexture] = useState<TWallpaperTexture>({
    type: textureType,
    strength: textureStrength,
  })

  useEffect(() => {
    setDraftTexture({ type: textureType, strength: textureStrength })
  }, [textureType, textureStrength])

  const updateTexture = (patch: Partial<TWallpaperTexture>): void => {
    const nextTexture = {
      ...draftTexture,
      ...patch,
      strength:
        patch.type && draftTexture.strength === 0 ? 45 : (patch.strength ?? draftTexture.strength),
    }

    setDraftTexture(nextTexture)
    changeTexture(nextTexture)
    flushWallpaperDraft()
  }

  const updateTextureStrengthDraft = (strength: number): void => {
    const nextTexture = { ...draftTexture, strength }

    setDraftTexture(nextTexture)
    changeTexture(nextTexture)
  }

  const commitTextureStrength = (strength: number): void => {
    const nextTexture = { ...draftTexture, strength }

    setDraftTexture(nextTexture)
    changeTexture(nextTexture)
    flushWallpaperDraft()
  }

  return (
    <div className={s.texturePanel}>
      <div className={s.textureControls}>
        <div className={s.textureRow}>
          <div className={s.textureLabel}>Texture</div>
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
            valueLabel='Intensity'
            aria-label='Intensity'
            onChange={updateTextureStrengthDraft}
            onChangeEnd={commitTextureStrength}
          />
        </div>
      </div>
    </div>
  )
}
