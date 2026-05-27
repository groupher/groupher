'use client'

import { useEffect, useMemo, useState } from 'react'

import { WALLPAPER_TYPE } from '~/const/wallpaper'
import useTrans from '~/hooks/useTrans'
import CheckedSVG from '~/icons/CheckBold'
import {
  buildMeshGradientFallback,
  parseMeshGradientValue,
  stringifyMeshGradientRecipe,
} from '~/lib/wallpaperMesh'
import type { TImageTextureType, TMeshGradientRecipe, TWallpaperTexture } from '~/lib/wallpaperMesh'
import useWallpaperDomain from '~/stores/wallpaper/hooks'
import RangeInput from '~/widgets/RangeInput'
import Tooltip from '~/widgets/Tooltip'

import useSalon, { cn } from './salon/diy_tab'

type TPreset = {
  key: string
  colors: string[]
  flow: number
  softness: number
  texture: TWallpaperTexture
  anchors: TMeshGradientRecipe['anchors']
}

const PRESETS: TPreset[] = [
  {
    key: 'pastel',
    colors: ['#fbeede', '#d8b9e3', '#f9fbff'],
    flow: 180,
    softness: 82,
    texture: { type: 'grain', strength: 8 },
    anchors: [
      { x: 0.5, y: 0.02, color: 0 },
      { x: 0.5, y: 0.98, color: 1 },
      { x: 0.92, y: 0.5, color: 2 },
    ],
  },
  {
    key: 'meadow',
    colors: ['#d6d9b8', '#87bb89', '#eef6df'],
    flow: 90,
    softness: 78,
    texture: { type: 'grain', strength: 6 },
    anchors: [
      { x: 0.02, y: 0.5, color: 0 },
      { x: 0.98, y: 0.5, color: 1 },
      { x: 0.58, y: 0.12, color: 2 },
    ],
  },
  {
    key: 'aurora',
    colors: ['#6f94db', '#64b2f4', '#83e4eb', '#dff8f2'],
    flow: 45,
    softness: 66,
    texture: { type: 'grain', strength: 18 },
    anchors: [
      { x: 0.08, y: 0.12, color: 0 },
      { x: 0.24, y: 0.82, color: 1 },
      { x: 0.9, y: 0.72, color: 2 },
      { x: 0.6, y: 0.22, color: 3 },
    ],
  },
  {
    key: 'sunset',
    colors: ['#ffefc4', '#ff9b80', '#c06577', '#6b80a7'],
    flow: 135,
    softness: 54,
    texture: { type: 'grain', strength: 14 },
    anchors: [
      { x: 0.12, y: 0.16, color: 0 },
      { x: 0.35, y: 0.78, color: 1 },
      { x: 0.86, y: 0.2, color: 2 },
      { x: 0.82, y: 0.84, color: 3 },
    ],
  },
  {
    key: 'ocean',
    colors: ['#d9f8ff', '#79d7f0', '#4f8bd8', '#233a7b'],
    flow: 160,
    softness: 72,
    texture: { type: 'grain', strength: 10 },
    anchors: [
      { x: 0.18, y: 0.18, color: 0 },
      { x: 0.78, y: 0.22, color: 1 },
      { x: 0.24, y: 0.82, color: 2 },
      { x: 0.86, y: 0.72, color: 3 },
    ],
  },
  {
    key: 'candy',
    colors: ['#ffe0f1', '#ff7eb6', '#8b5cf6', '#5eead4'],
    flow: 125,
    softness: 58,
    texture: { type: 'grain', strength: 12 },
    anchors: [
      { x: 0.14, y: 0.24, color: 0 },
      { x: 0.42, y: 0.76, color: 1 },
      { x: 0.82, y: 0.18, color: 2 },
      { x: 0.8, y: 0.82, color: 3 },
    ],
  },
  {
    key: 'peach',
    colors: ['#fff4d6', '#ffd1a8', '#f59e9e', '#c084fc'],
    flow: 210,
    softness: 64,
    texture: { type: 'grain', strength: 9 },
    anchors: [
      { x: 0.18, y: 0.16, color: 0 },
      { x: 0.66, y: 0.2, color: 1 },
      { x: 0.3, y: 0.78, color: 2 },
      { x: 0.86, y: 0.74, color: 3 },
    ],
  },
  {
    key: 'midnight',
    colors: ['#111827', '#312e81', '#0f766e', '#bae6fd'],
    flow: 30,
    softness: 52,
    texture: { type: 'grain', strength: 16 },
    anchors: [
      { x: 0.12, y: 0.18, color: 0 },
      { x: 0.72, y: 0.22, color: 1 },
      { x: 0.3, y: 0.84, color: 2 },
      { x: 0.9, y: 0.78, color: 3 },
    ],
  },
  {
    key: 'mint',
    colors: ['#74d3a7', '#b9eca6', '#f5dfc8', '#efb7bb'],
    flow: 105,
    softness: 70,
    texture: { type: 'grain', strength: 8 },
    anchors: [
      { x: 0.14, y: 0.2, color: 0 },
      { x: 0.72, y: 0.2, color: 1 },
      { x: 0.3, y: 0.82, color: 2 },
      { x: 0.88, y: 0.76, color: 3 },
    ],
  },
  {
    key: 'mist',
    colors: ['#d8e2e8', '#bcc7d0', '#c9c0cb', '#9ba6bc'],
    flow: 155,
    softness: 76,
    texture: { type: 'grain', strength: 10 },
    anchors: [
      { x: 0.18, y: 0.18, color: 0 },
      { x: 0.76, y: 0.18, color: 1 },
      { x: 0.28, y: 0.78, color: 2 },
      { x: 0.86, y: 0.78, color: 3 },
    ],
  },
  {
    key: 'cream',
    colors: ['#ffe1a8', '#e9c394', '#cbb9a1', '#a7b8ac'],
    flow: 65,
    softness: 68,
    texture: { type: 'grain', strength: 7 },
    anchors: [
      { x: 0.12, y: 0.22, color: 0 },
      { x: 0.64, y: 0.18, color: 1 },
      { x: 0.24, y: 0.84, color: 2 },
      { x: 0.9, y: 0.72, color: 3 },
    ],
  },
  {
    key: 'sky',
    colors: ['#fedfa3', '#ecc896', '#85c9e9', '#4f9fd1'],
    flow: 235,
    softness: 62,
    texture: { type: 'grain', strength: 9 },
    anchors: [
      { x: 0.14, y: 0.16, color: 0 },
      { x: 0.58, y: 0.24, color: 1 },
      { x: 0.28, y: 0.82, color: 2 },
      { x: 0.86, y: 0.74, color: 3 },
    ],
  },
  {
    key: 'coral-teal',
    colors: ['#ffe6dc', '#ff9f8f', '#65d6d0', '#2f7f93'],
    flow: 120,
    softness: 64,
    texture: { type: 'grain', strength: 8 },
    anchors: [
      { x: 0.12, y: 0.18, color: 0 },
      { x: 0.48, y: 0.78, color: 1 },
      { x: 0.78, y: 0.2, color: 2 },
      { x: 0.88, y: 0.78, color: 3 },
    ],
  },
  {
    key: 'mineral',
    colors: ['#eef5f6', '#c9d7dc', '#9ab0be', '#d9c7d7'],
    flow: 205,
    softness: 80,
    texture: { type: 'grain', strength: 12 },
    anchors: [
      { x: 0.18, y: 0.18, color: 0 },
      { x: 0.78, y: 0.24, color: 1 },
      { x: 0.24, y: 0.82, color: 2 },
      { x: 0.86, y: 0.72, color: 3 },
    ],
  },
  {
    key: 'plum',
    colors: ['#f3d9ee', '#c8a2d8', '#7f6cc8', '#3c3b7b'],
    flow: 30,
    softness: 58,
    texture: { type: 'grain', strength: 10 },
    anchors: [
      { x: 0.16, y: 0.22, color: 0 },
      { x: 0.7, y: 0.16, color: 1 },
      { x: 0.36, y: 0.82, color: 2 },
      { x: 0.88, y: 0.78, color: 3 },
    ],
  },
  {
    key: 'saffron',
    colors: ['#fff1b8', '#f5a524', '#10b981', '#06b6d4'],
    flow: 150,
    softness: 55,
    texture: { type: 'grain', strength: 11 },
    anchors: [
      { x: 0.14, y: 0.2, color: 0 },
      { x: 0.68, y: 0.18, color: 1 },
      { x: 0.28, y: 0.8, color: 2 },
      { x: 0.88, y: 0.78, color: 3 },
    ],
  },
]

const TEXTURE_OPTIONS: { type: TImageTextureType; label: string }[] = [
  { type: 'grain', label: 'Grain' },
  { type: 'pixelate', label: 'Pixelate' },
  { type: 'screentone', label: 'Screentone' },
  { type: 'dither', label: 'Dither' },
]

const makeRecipe = (preset: TPreset, seed = Date.now()): TMeshGradientRecipe => ({
  version: 1,
  kind: 'mesh',
  preset: preset.key,
  seed,
  colors: preset.colors,
  flow: preset.flow,
  softness: preset.softness,
  texture: preset.texture,
  contrast: 100,
  brightness: 100,
  anchors: preset.anchors,
})

const getInitialRecipe = (customColorValue?: string | null): TMeshGradientRecipe =>
  parseMeshGradientValue(customColorValue) || makeRecipe(PRESETS[0], 18432)

export default function DiyTab() {
  const s = useSalon()
  const { customColorValue, commit } = useWallpaperDomain()

  const recipe = useMemo(() => getInitialRecipe(customColorValue), [customColorValue])

  const commitRecipe = (recipe: TMeshGradientRecipe): void => {
    commit?.({
      source: '',
      type: WALLPAPER_TYPE.CUSTOM_GRADIENT,
      customColorValue: stringifyMeshGradientRecipe(recipe),
    })
  }

  return (
    <div className={s.wrapper}>
      <div className={s.presets}>
        {PRESETS.map((preset) => {
          const selected = recipe.preset === preset.key
          const presetRecipe = makeRecipe(preset, recipe.seed)
          const previewRecipe = selected ? recipe : presetRecipe

          return (
            <button
              type='button'
              key={preset.key}
              className={cn(s.presetCard, selected && s.presetActive)}
              onClick={() => commitRecipe(presetRecipe)}
            >
              {selected && (
                <div className={s.activeSign}>
                  <CheckedSVG className={s.checkIcon} />
                </div>
              )}
              <div
                className={s.presetPreview}
                style={{ background: buildMeshGradientFallback(previewRecipe) }}
              />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function DiySettings() {
  const s = useSalon()
  const { customColorValue, commit } = useWallpaperDomain()
  const { locale } = useTrans()
  const sourceRecipe = useMemo(() => getInitialRecipe(customColorValue), [customColorValue])
  const [draftRecipe, setDraftRecipe] = useState(sourceRecipe)
  const textureLabel = locale === 'zh' || locale === 'zh-hant' ? '质感' : 'Texture'
  const intensityLabel = locale === 'zh' || locale === 'zh-hant' ? '强度' : 'Intensity'

  useEffect(() => {
    setDraftRecipe(sourceRecipe)
  }, [sourceRecipe])

  const commitRecipe = (nextRecipe: TMeshGradientRecipe): void => {
    commit?.({
      source: '',
      type: WALLPAPER_TYPE.CUSTOM_GRADIENT,
      customColorValue: stringifyMeshGradientRecipe(nextRecipe),
    })
  }

  const updateTexture = (patch: Partial<TWallpaperTexture>): void => {
    const nextRecipe = {
      ...draftRecipe,
      texture: { ...draftRecipe.texture, ...patch },
    }

    setDraftRecipe(nextRecipe)
    commitRecipe(nextRecipe)
  }

  const updateColor = (index: number, color: string): void => {
    const nextRecipe = {
      ...draftRecipe,
      colors: draftRecipe.colors.map((value, valueIndex) => (valueIndex === index ? color : value)),
    }

    setDraftRecipe(nextRecipe)
    commitRecipe(nextRecipe)
  }

  const updateSoftnessDraft = (softness: number): void => {
    setDraftRecipe((current) => ({ ...current, softness }))
  }

  const commitSoftness = (softness: number): void => {
    const nextRecipe = { ...draftRecipe, softness }

    setDraftRecipe(nextRecipe)
    commitRecipe(nextRecipe)
  }

  const updateTextureStrengthDraft = (strength: number): void => {
    setDraftRecipe((current) => ({
      ...current,
      texture: { ...current.texture, strength },
    }))
  }

  const commitTextureStrength = (strength: number): void => {
    const nextRecipe = {
      ...draftRecipe,
      texture: { ...draftRecipe.texture, strength },
    }

    setDraftRecipe(nextRecipe)
    commitRecipe(nextRecipe)
  }

  return (
    <div className={s.settingsWrapper}>
      <div className={s.controls}>
        <div className={s.panel}>
          <div className={s.label}>Colors</div>
          <div className={s.chips}>
            {draftRecipe.colors.map((color, index) => (
              <label
                key={`${color}-${draftRecipe.anchors[index]?.x}-${draftRecipe.anchors[index]?.y}`}
                className={s.chip}
                style={{ background: color }}
                aria-label={`Change color ${index + 1}`}
              >
                <input
                  className={s.colorInput}
                  type='color'
                  value={color}
                  onChange={(event) => updateColor(index, event.target.value)}
                />
              </label>
            ))}
          </div>
        </div>

        <div className={s.rangeGroup}>
          <RangeInput
            value={draftRecipe.softness}
            min={0}
            max={100}
            step={1}
            labelPlacement='left'
            valueLabel='Spread'
            aria-label='Spread'
            onChange={updateSoftnessDraft}
            onChangeEnd={commitSoftness}
          />
          <div className={s.textureControl}>
            <div className={s.textureRow}>
              <div className={s.textureLabel}>{textureLabel}</div>
              <div className={s.textureOptions}>
                {TEXTURE_OPTIONS.map(({ type, label }) => {
                  const selected = draftRecipe.texture.type === type

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
                        <div
                          className={s.textureSwatchPreview}
                          style={s.texturePatternStyle(type)}
                        />
                      </button>
                    </Tooltip>
                  )
                })}
              </div>
            </div>
            <div className={s.textureStrength}>
              <RangeInput
                value={draftRecipe.texture.strength}
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
      </div>
    </div>
  )
}
