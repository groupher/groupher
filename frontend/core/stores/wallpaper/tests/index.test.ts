import { WALLPAPER_TYPE } from '~/const/wallpaper'

import setupStore, { INITIAL_WALLPAPER_STATE } from '..'

describe('stores/wallpaper', () => {
  it('starts from initial state and supports edge commits', () => {
    const store = setupStore()

    expect(store.wallpaper).toBe(INITIAL_WALLPAPER_STATE.wallpaper)
    expect(store.wallpaperType).toBe(INITIAL_WALLPAPER_STATE.wallpaperType)
    expect(store.hasPattern).toBe(true)

    store.commit({
      wallpaper: 'blank',
      wallpaperType: WALLPAPER_TYPE.PATTERN,
      hasBlur: true,
      hasPattern: false,
      customColorValue: ' #fff , #000  ',
    })

    expect(store.wallpaper).toBe('blank')
    expect(store.wallpaperType).toBe(WALLPAPER_TYPE.PATTERN)
    expect(store.hasBlur).toBe(true)
    expect(store.hasPattern).toBe(false)
    expect(store.customColorValue).toBe(' #fff , #000  ')
  })
})
