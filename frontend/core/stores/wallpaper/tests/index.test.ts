import {
  DEFAULT_WALLPAPER_PATTERN_ID,
  GRADIENT_WALLPAPER,
  GRADIENT_WALLPAPER_NAME,
  WALLPAPER_PATTERN_TONE,
  WALLPAPER_TYPE,
} from '~/const/wallpaper'
import { WALLPAPER_TEXTURE } from '~/lib/wallpaperMesh'

import setupStore from '..'
import { INITIAL_WALLPAPER_STATE, INITIAL_WALLPAPER_THEME_STATE } from '../constant'

describe('stores/wallpaper', () => {
  it('starts from initial state and supports edge commits', () => {
    const store = setupStore()

    expect(store.light.source).toBe(INITIAL_WALLPAPER_STATE.light.source)
    expect(store.light.type).toBe(INITIAL_WALLPAPER_STATE.light.type)
    expect(store.light.pattern.enabled).toBe(true)
    expect(store.light.pattern.id).toBe(DEFAULT_WALLPAPER_PATTERN_ID)
    expect(store.light.pattern.intensity).toBe(50)
    expect(store.light.pattern.tone).toBe(WALLPAPER_PATTERN_TONE.DARK)
    expect(store.light.texture.enabled).toBe(false)
    expect(store.light.gradient).toEqual(GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.AMBER_MAUVE])
    expect(store.light.effect.brightness).toBe(100)
    expect(store.light.effect.saturation).toBe(100)
    expect(store.light.texture).toEqual({
      enabled: false,
      type: WALLPAPER_TEXTURE.NOISE,
      intensity: 0,
      params: {},
    })

    store.commit({
      light: {
        source: 'blank',
        type: WALLPAPER_TYPE.PATTERN,
        effect: { blurIntensity: 35, brightness: 90, saturation: 120 },
        pattern: {
          enabled: false,
          id: '02',
          intensity: 65,
          tone: WALLPAPER_PATTERN_TONE.LIGHT,
        },
        gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.STONE_GREEN], angle: 90 },
        texture: { enabled: true, type: WALLPAPER_TEXTURE.ASCII, intensity: 55, params: {} },
      },
    })

    expect(store.light.source).toBe('blank')
    expect(store.light.type).toBe(WALLPAPER_TYPE.PATTERN)
    expect(store.light.effect.blurIntensity).toBe(35)
    expect(store.light.pattern.enabled).toBe(false)
    expect(store.light.pattern.id).toBe('02')
    expect(store.light.pattern.intensity).toBe(65)
    expect(store.light.pattern.tone).toBe(WALLPAPER_PATTERN_TONE.LIGHT)
    expect(store.light.texture.enabled).toBe(true)
    expect(store.light.effect.brightness).toBe(90)
    expect(store.light.effect.saturation).toBe(120)
    expect(store.light.gradient).toEqual({
      ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.STONE_GREEN],
      angle: 90,
    })
    expect(store.light.texture).toEqual({
      enabled: true,
      type: WALLPAPER_TEXTURE.ASCII,
      intensity: 55,
      params: {},
    })
  })

  it('uses hydrated wallpaper as the original baseline', () => {
    const store = setupStore({
      light: {
        source: 'backiee-1',
        type: WALLPAPER_TYPE.PATTERN,
        pattern: {
          enabled: false,
          id: '03',
          intensity: 65,
          tone: WALLPAPER_PATTERN_TONE.LIGHT,
        },
        gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.STONE_GREEN], angle: 45 },
        effect: { blurIntensity: 35, brightness: 85, saturation: 120 },
        contentShadow: { enabled: true },
        texture: { enabled: true, type: WALLPAPER_TEXTURE.TILE, intensity: 72, params: {} },
      },
    })

    expect(store.light.source).toBe('backiee-1')
    expect(store.original).toEqual({
      ...INITIAL_WALLPAPER_STATE,
      light: {
        ...INITIAL_WALLPAPER_THEME_STATE,
        source: 'backiee-1',
        type: WALLPAPER_TYPE.PATTERN,
        pattern: {
          enabled: false,
          id: '03',
          intensity: 65,
          tone: WALLPAPER_PATTERN_TONE.LIGHT,
        },
        gradient: { ...GRADIENT_WALLPAPER[GRADIENT_WALLPAPER_NAME.STONE_GREEN], angle: 45 },
        effect: { blurIntensity: 35, brightness: 85, saturation: 120 },
        contentShadow: { enabled: true },
        texture: { enabled: true, type: WALLPAPER_TEXTURE.TILE, intensity: 72, params: {} },
      },
    })
  })
})
