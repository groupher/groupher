import { WALLPAPER_TYPE } from '~/const/wallpaper'
import { GRADIENT_RENDERER, WALLPAPER_TEXTURE } from '~/lib/wallpaperMesh'

import setupStore from '.'
import {
  getWallpaperSavablePatch,
  resolveWallpaperThemeState,
  toWallpaperThemePatch,
} from './helper'

describe('stores/wallpaper/helper', () => {
  it('resolves the active light or dark wallpaper state', () => {
    const store = setupStore({
      source: 'pink',
      sourceDark: 'purple',
      brightness: 100,
      brightnessDark: 82,
      gradient: {
        version: 2,
        renderer: GRADIENT_RENDERER.LINEAR,
        preset: 'pink',
        colors: ['#fff', '#ddd'],
        angle: 180,
        spread: 52,
      },
      gradientDark: {
        version: 2,
        renderer: GRADIENT_RENDERER.LINEAR,
        preset: 'purple',
        colors: ['#111', '#333'],
        angle: 90,
        spread: 52,
      },
    })

    expect(resolveWallpaperThemeState(store, false)).toMatchObject({
      source: 'pink',
      brightness: 100,
      gradient: expect.objectContaining({ preset: 'pink' }),
    })
    expect(resolveWallpaperThemeState(store, true)).toMatchObject({
      source: 'purple',
      brightness: 82,
      gradient: expect.objectContaining({ preset: 'purple' }),
    })
  })

  it('maps current-theme edit patches to dark fields only in dark theme', () => {
    expect(toWallpaperThemePatch({ source: 'orange' }, false)).toEqual({ source: 'orange' })
    expect(toWallpaperThemePatch({ source: 'orange', type: WALLPAPER_TYPE.PATTERN }, true)).toEqual(
      {
        sourceDark: 'orange',
        typeDark: WALLPAPER_TYPE.PATTERN,
      },
    )
  })

  it('builds a sparse savable patch from original to current state', () => {
    const store = setupStore({
      source: 'pink',
      sourceDark: 'purple',
      texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
      textureDark: { type: WALLPAPER_TEXTURE.TILE, intensity: 40, params: {} },
    })

    store.commit({
      sourceDark: 'blue',
      textureDark: { type: WALLPAPER_TEXTURE.ASCII, intensity: 55, params: {} },
    })

    expect(getWallpaperSavablePatch(store)).toEqual({
      sourceDark: 'blue',
      textureDark: { type: WALLPAPER_TEXTURE.ASCII, intensity: 55, params: {} },
    })
  })
})
