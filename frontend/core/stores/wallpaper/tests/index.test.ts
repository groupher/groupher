import { WALLPAPER_TYPE } from '~/const/wallpaper'
import { WALLPAPER_TEXTURE } from '~/lib/wallpaperMesh'

import setupStore, { INITIAL_WALLPAPER_STATE } from '..'

describe('stores/wallpaper', () => {
  it('starts from initial state and supports edge commits', () => {
    const store = setupStore()

    expect(store.source).toBe(INITIAL_WALLPAPER_STATE.source)
    expect(store.type).toBe(INITIAL_WALLPAPER_STATE.type)
    expect(store.hasPattern).toBe(true)
    expect(store.gradientDeg).toBe(180)
    expect(store.brightness).toBe(100)
    expect(store.saturation).toBe(100)
    expect(store.texture).toEqual({ type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} })

    store.commit({
      source: 'blank',
      type: WALLPAPER_TYPE.PATTERN,
      blurIntensity: 35,
      hasPattern: false,
      bgSize: 'contain',
      brightness: 90,
      saturation: 120,
      gradientDeg: 90,
      texture: { type: WALLPAPER_TEXTURE.DITHER, intensity: 55, params: {} },
    })

    expect(store.source).toBe('blank')
    expect(store.type).toBe(WALLPAPER_TYPE.PATTERN)
    expect(store.blurIntensity).toBe(35)
    expect(store.hasPattern).toBe(false)
    expect(store.bgSize).toBe('contain')
    expect(store.brightness).toBe(90)
    expect(store.saturation).toBe(120)
    expect(store.gradientDeg).toBe(90)
    expect(store.texture).toEqual({ type: WALLPAPER_TEXTURE.DITHER, intensity: 55, params: {} })
  })
})
