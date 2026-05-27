import { WALLPAPER_TYPE } from '~/const/wallpaper'

import setupStore, { INITIAL_WALLPAPER_STATE } from '..'

describe('stores/wallpaper', () => {
  it('starts from initial state and supports edge commits', () => {
    const store = setupStore()

    expect(store.source).toBe(INITIAL_WALLPAPER_STATE.source)
    expect(store.type).toBe(INITIAL_WALLPAPER_STATE.type)
    expect(store.hasPattern).toBe(true)
    expect(store.brightness).toBe(100)
    expect(store.saturation).toBe(100)
    expect(store.textureType).toBe('grain')
    expect(store.textureStrength).toBe(0)

    store.commit({
      source: 'blank',
      type: WALLPAPER_TYPE.PATTERN,
      blurIntensity: 35,
      hasPattern: false,
      bgSize: 'contain',
      brightness: 90,
      saturation: 120,
      textureType: 'dither',
      textureStrength: 55,
      customColorValue: ' #fff , #000  ',
    })

    expect(store.source).toBe('blank')
    expect(store.type).toBe(WALLPAPER_TYPE.PATTERN)
    expect(store.blurIntensity).toBe(35)
    expect(store.hasPattern).toBe(false)
    expect(store.bgSize).toBe('contain')
    expect(store.brightness).toBe(90)
    expect(store.saturation).toBe(120)
    expect(store.textureType).toBe('dither')
    expect(store.textureStrength).toBe(55)
    expect(store.customColorValue).toBe(' #fff , #000  ')
  })
})
