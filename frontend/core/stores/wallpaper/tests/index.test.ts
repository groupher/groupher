import {
  DEFAULT_WALLPAPER_PATTERN_ID,
  GRADIENT_WALLPAPER,
  GRADIENT_WALLPAPER_NAME,
  WALLPAPER_PATTERN_TONE,
  WALLPAPER_TYPE,
} from '~/const/wallpaper'
import { WALLPAPER_TEXTURE } from '~/lib/wallpaperMesh'

import setupStore, { INITIAL_WALLPAPER_STATE } from '..'

describe('stores/wallpaper', () => {
  it('starts from initial state and supports edge commits', () => {
    const store = setupStore()

    expect(store.source).toBe(INITIAL_WALLPAPER_STATE.source)
    expect(store.type).toBe(INITIAL_WALLPAPER_STATE.type)
    expect(store.hasPattern).toBe(true)
    expect(store.patternId).toBe(DEFAULT_WALLPAPER_PATTERN_ID)
    expect(store.patternIntensity).toBe(100)
    expect(store.patternTone).toBe(WALLPAPER_PATTERN_TONE.DARK)
    expect(store.hasTexture).toBe(false)
    expect(store.gradient).toEqual(GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.PINK])
    expect(store.brightness).toBe(100)
    expect(store.saturation).toBe(100)
    expect(store.texture).toEqual({ type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} })

    store.commit({
      source: 'blank',
      type: WALLPAPER_TYPE.PATTERN,
      blurIntensity: 35,
      hasPattern: false,
      patternId: '02',
      patternIntensity: 65,
      patternTone: WALLPAPER_PATTERN_TONE.LIGHT,
      hasTexture: true,
      bgSize: 'contain',
      brightness: 90,
      saturation: 120,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.GREEN], angle: 90 },
      texture: { type: WALLPAPER_TEXTURE.ASCII, intensity: 55, params: {} },
    })

    expect(store.source).toBe('blank')
    expect(store.type).toBe(WALLPAPER_TYPE.PATTERN)
    expect(store.blurIntensity).toBe(35)
    expect(store.hasPattern).toBe(false)
    expect(store.patternId).toBe('02')
    expect(store.patternIntensity).toBe(65)
    expect(store.patternTone).toBe(WALLPAPER_PATTERN_TONE.LIGHT)
    expect(store.hasTexture).toBe(true)
    expect(store.bgSize).toBe('contain')
    expect(store.brightness).toBe(90)
    expect(store.saturation).toBe(120)
    expect(store.gradient).toEqual({
      ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.GREEN],
      angle: 90,
    })
    expect(store.texture).toEqual({ type: WALLPAPER_TEXTURE.ASCII, intensity: 55, params: {} })
  })

  it('uses hydrated wallpaper as the original baseline', () => {
    const store = setupStore({
      source: 'backiee-1',
      type: WALLPAPER_TYPE.PATTERN,
      hasPattern: false,
      patternId: '03',
      patternIntensity: 65,
      patternTone: WALLPAPER_PATTERN_TONE.LIGHT,
      hasTexture: true,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.GREEN], angle: 45 },
      blurIntensity: 35,
      hasShadow: true,
      brightness: 85,
      saturation: 120,
      bgSize: 'contain',
      texture: { type: WALLPAPER_TEXTURE.TILE, intensity: 72, params: {} },
    })

    expect(store.source).toBe('backiee-1')
    expect(store.original).toEqual({
      ...INITIAL_WALLPAPER_STATE,
      source: 'backiee-1',
      type: WALLPAPER_TYPE.PATTERN,
      hasPattern: false,
      patternId: '03',
      patternIntensity: 65,
      patternTone: WALLPAPER_PATTERN_TONE.LIGHT,
      hasTexture: true,
      gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.GREEN], angle: 45 },
      blurIntensity: 35,
      hasShadow: true,
      brightness: 85,
      saturation: 120,
      bgSize: 'contain',
      texture: { type: WALLPAPER_TEXTURE.TILE, intensity: 72, params: {} },
    })
  })
})
