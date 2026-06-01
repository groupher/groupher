import { act, renderHook, waitFor } from '@testing-library/react'

import {
  DEFAULT_WALLPAPER_PATTERN_ID,
  GRADIENT_WALLPAPER,
  GRADIENT_WALLPAPER_NAME,
  WALLPAPER_PATTERN_TONE,
  WALLPAPER_TYPE,
} from '~/const/wallpaper'
import { makeStoreWrapper } from '~/hooks/__test__/makeStoreWrapper'
import useFullWallpaper from '~/hooks/useFullWallpaper'
import { GRADIENT_RENDERER } from '~/lib/wallpaperMesh'
import { WALLPAPER_TEXTURE } from '~/lib/wallpaperMesh'
import type { TWallpaperPic } from '~/spec'

describe('useFullWallpaper', () => {
  it('returns data and can commit wallpaper changes', async () => {
    const wrapper = makeStoreWrapper({
      wallpaper: {
        source: GRADIENT_WALLPAPER_NAME.AMBER_MAUVE,
        type: WALLPAPER_TYPE.GRADIENT,
        hasPattern: true,
        patternId: DEFAULT_WALLPAPER_PATTERN_ID,
        patternIntensity: 100,
        patternTone: WALLPAPER_PATTERN_TONE.DARK,
        hasTexture: false,
        blurIntensity: 0,
        brightness: 100,
        saturation: 100,
        texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
        gradient: GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.AMBER_MAUVE],
      },
    })

    const { result } = renderHook(() => useFullWallpaper(), { wrapper })

    const data = result.current.getWallpaper()
    expect(data.source).toBe(GRADIENT_WALLPAPER_NAME.AMBER_MAUVE)
    expect(data.type).toBe(WALLPAPER_TYPE.GRADIENT)
    expect(data.patternId).toBe(DEFAULT_WALLPAPER_PATTERN_ID)
    expect(data.patternIntensity).toBe(100)
    expect(data.patternTone).toBe(WALLPAPER_PATTERN_TONE.DARK)
    expect(data.hasTexture).toBe(false)
    expect(data.brightness).toBe(100)
    expect(data.saturation).toBe(100)
    expect(data.texture).toEqual({ type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} })

    const amberMauve = data.gradientWallpapers.amber_mauve
    expect('colors' in amberMauve).toBe(true)
    expect(amberMauve.renderer).toBe(GRADIENT_RENDERER.LINEAR)
    expect(data.gradientPalettes.amber_mauve).toEqual({
      key: GRADIENT_WALLPAPER_NAME.AMBER_MAUVE,
      label: 'Amber Mauve',
      colors: GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.AMBER_MAUVE].colors,
    })
    expect(data.gradientPalettes.amber_mauve).not.toHaveProperty('angle')
    expect(data.gradientPalettes.amber_mauve).not.toHaveProperty('spread')

    act(() => result.current.changePatternWallpaper('dots'))

    await waitFor(() => {
      expect(result.current.source).toBe('dots')
    })
  })

  it('keeps gradient catalog previews static', () => {
    const wrapper = makeStoreWrapper({
      wallpaper: {
        source: GRADIENT_WALLPAPER_NAME.TEAL_INDIGO_MAUVE,
        type: WALLPAPER_TYPE.GRADIENT,
        hasPattern: true,
        patternId: DEFAULT_WALLPAPER_PATTERN_ID,
        patternIntensity: 100,
        patternTone: WALLPAPER_PATTERN_TONE.DARK,
        blurIntensity: 50,
        gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.TEAL_INDIGO_MAUVE], angle: 90 },
      },
    })

    const { result } = renderHook(() => useFullWallpaper(), { wrapper })
    const data = result.current.getWallpaper()

    const active = data.gradientWallpapers[GRADIENT_WALLPAPER_NAME.TEAL_INDIGO_MAUVE]
    const defaultPattern = data.gradientWallpapers[GRADIENT_WALLPAPER_NAME.STONE_GREEN]

    expect(active).toMatchObject({ renderer: GRADIENT_RENDERER.LINEAR, angle: 180 })

    expect(defaultPattern).toMatchObject({ renderer: GRADIENT_RENDERER.LINEAR, angle: 180 })
  })

  it('keeps pattern catalog previews static', () => {
    const wrapper = makeStoreWrapper({
      wallpaper: {
        source: 'backiee-1',
        type: WALLPAPER_TYPE.PATTERN,
        blurIntensity: 50,
        brightness: 75,
        saturation: 130,
      },
    })

    const { result } = renderHook(() => useFullWallpaper(), { wrapper })
    const data = result.current.getWallpaper()

    const active = data.patternWallpapers['backiee-1'] as TWallpaperPic
    const inactive = data.patternWallpapers['backiee-2'] as TWallpaperPic

    expect(active.blurIntensity).toBe(0)
    expect(active.brightness).toBeUndefined()
    expect(active.saturation).toBeUndefined()
    expect(active.image).toBe('/wallpaper/picture/backiee-1.webp')
    expect(active.preview).toBe('/wallpaper/picture-preview/backiee-1.webp')
    expect(inactive.blurIntensity).toBe(0)
  })
})
