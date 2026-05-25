import { WALLPAPER_TYPE } from '~/const/wallpaper'

import setupStore, { INITIAL_WALLPAPER_STATE } from '..'

describe('stores/wallpaper', () => {
  it('starts from initial state and supports edge commits', () => {
    const store = setupStore()

    expect(store.source).toBe(INITIAL_WALLPAPER_STATE.source)
    expect(store.type).toBe(INITIAL_WALLPAPER_STATE.type)
    expect(store.hasPattern).toBe(true)

    store.commit({
      source: 'blank',
      type: WALLPAPER_TYPE.PATTERN,
      hasBlur: true,
      hasPattern: false,
      customColorValue: ' #fff , #000  ',
    })

    expect(store.source).toBe('blank')
    expect(store.type).toBe(WALLPAPER_TYPE.PATTERN)
    expect(store.hasBlur).toBe(true)
    expect(store.hasPattern).toBe(false)
    expect(store.customColorValue).toBe(' #fff , #000  ')
  })
})
