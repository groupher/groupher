import { useMemo, useState } from 'react'

import {
  GRADIENT_WALLPAPER,
  GRADIENT_WALLPAPER_NAME,
  WALLPAPER_PATTERN_TONE,
  WALLPAPER_TYPE,
} from '~/const/wallpaper'
import type { TBgConfig } from '~/lib/bg'
import { GRADIENT_RENDERER, WALLPAPER_TEXTURE } from '~/lib/wallpaperMesh'
import type { TDocCoverPinnedDoc, TDocCoverPinnedDocAppearance } from '~/unit/DocCovers/spec'
import Input from '~/widgets/Input'
import ThemeSwitch from '~/widgets/ThemeSwitch'

type TProps = {
  doc: TDocCoverPinnedDoc
  saving?: boolean
  onSave: (appearance: TDocCoverPinnedDocAppearance) => void
}

type TAppearanceTheme = keyof TDocCoverPinnedDocAppearance

const BASE_BG: TBgConfig = {
  customWallpaper: null,
  source: '',
  type: WALLPAPER_TYPE.NONE,
  pattern: { enabled: false, id: '01', intensity: 0, tone: WALLPAPER_PATTERN_TONE.DARK },
  gradient: null,
  effect: { blurIntensity: 0, brightness: 100, saturation: 100 },
  texture: { enabled: false, type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
}

const PRESETS = [
  GRADIENT_WALLPAPER_NAME.AMBER_MAUVE,
  GRADIENT_WALLPAPER_NAME.STONE_GREEN,
  GRADIENT_WALLPAPER_NAME.SKY_MAUVE_BLUE,
  GRADIENT_WALLPAPER_NAME.SLATE_TEAL_EMERALD,
] as const

const gradientBg = (source: string): TBgConfig => ({
  ...BASE_BG,
  source,
  type: WALLPAPER_TYPE.GRADIENT,
  gradient: GRADIENT_WALLPAPER[source],
})

const solidBg = (color: string): TBgConfig => ({
  ...BASE_BG,
  source: `solid:${color}`,
  type: WALLPAPER_TYPE.GRADIENT,
  gradient: {
    version: 2,
    renderer: GRADIENT_RENDERER.LINEAR,
    preset: `solid:${color}`,
    colors: [color, color],
    angle: 180,
    spread: 100,
  },
})

const imageBg = (url: string): TBgConfig => ({
  ...BASE_BG,
  source: url,
  type: WALLPAPER_TYPE.UPLOAD,
  customWallpaper: { image: url },
})

export default function PinnedDocAppearancePanel({ doc, saving = false, onSave }: TProps) {
  const [theme, setTheme] = useState<TAppearanceTheme>('light')
  const [appearance, setAppearance] = useState<TDocCoverPinnedDocAppearance>(() => doc.appearance)
  const [imageUrl, setImageUrl] = useState('')
  const current = useMemo(() => appearance[theme], [appearance, theme])
  const updateTheme = (config: TBgConfig): void => {
    setAppearance((value) => ({ ...value, [theme]: config }))
  }

  return (
    <div className='column gap-6 p-8'>
      <div className='row-center'>
        <div className='column grow gap-1'>
          <h2 className='m-0 text-xl font-semibold'>{doc.doc.title}</h2>
          <p className='text-digest m-0 text-sm'>Pinned card background</p>
        </div>
        <ThemeSwitch />
      </div>
      <div className='row gap-2'>
        {(['light', 'dark'] as const).map((value) => (
          <button
            key={value}
            type='button'
            className={`h-10 rounded-lg px-4 capitalize ${theme === value ? 'bg-hoverBg font-medium' : ''}`}
            onClick={() => setTheme(value)}
          >
            {value}
          </button>
        ))}
      </div>
      <div className='column gap-3'>
        <span className='text-sm font-medium'>Solid color</span>
        <input
          type='color'
          className='h-10 w-full rounded-lg'
          defaultValue='#d8b9e3'
          onChange={(event) => updateTheme(solidBg(event.target.value))}
        />
      </div>
      <div className='column gap-3'>
        <span className='text-sm font-medium'>Gradients</span>
        <div className='grid grid-cols-2 gap-3'>
          {PRESETS.map((preset) => (
            <button
              key={preset}
              type='button'
              className='bg-alphaBg h-16 rounded-xl px-3 text-left text-sm transition-transform active:scale-96'
              onClick={() => updateTheme(gradientBg(preset))}
            >
              {preset.replaceAll('_', ' ')}
            </button>
          ))}
        </div>
      </div>
      <div className='column gap-3'>
        <span className='text-sm font-medium'>Image</span>
        <div className='row gap-2'>
          <Input
            value={imageUrl}
            placeholder='https://...'
            onChange={(event) => setImageUrl(event.target.value)}
          />
          <button
            type='button'
            className='bg-hoverBg h-10 rounded-lg px-4'
            disabled={!imageUrl}
            onClick={() => updateTheme(imageBg(imageUrl))}
          >
            Apply
          </button>
        </div>
      </div>
      <div className='text-digest text-xs'>Current: {current.type || 'default'}</div>
      <button
        type='button'
        className='bg-button-fg h-11 rounded-lg px-5 text-white disabled:opacity-50'
        disabled={saving}
        onClick={() => onSave(appearance)}
      >
        {saving ? 'Saving...' : 'Save appearance'}
      </button>
    </div>
  )
}
