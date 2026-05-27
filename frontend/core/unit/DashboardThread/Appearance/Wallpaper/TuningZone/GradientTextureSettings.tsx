import { useState } from 'react'

import type { TImageTextureType, TWallpaperTexture } from '~/lib/wallpaperMesh'
import RangeInput from '~/widgets/RangeInput'
import Tooltip from '~/widgets/Tooltip'

import useSalon, { cn } from '../salon/tuning_zone'

const TEXTURE_OPTIONS: { type: TImageTextureType; label: string }[] = [
  { type: 'grain', label: 'Grain' },
  { type: 'pixelate', label: 'Pixelate' },
  { type: 'screentone', label: 'Screentone' },
  { type: 'dither', label: 'Dither' },
]

export default function GradientTextureSettings() {
  const s = useSalon()
  const [draftTexture, setDraftTexture] = useState<TWallpaperTexture>({
    type: 'grain',
    strength: 45,
  })

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
