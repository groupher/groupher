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
      source: 'amber_mauve',
      sourceDark: 'teal_indigo_mauve',
      brightness: 100,
      brightnessDark: 82,
      gradient: {
        version: 2,
        renderer: GRADIENT_RENDERER.LINEAR,
        preset: 'amber_mauve',
        colors: ['#fff', '#ddd'],
        angle: 180,
        spread: 52,
      },
      gradientDark: {
        version: 2,
        renderer: GRADIENT_RENDERER.LINEAR,
        preset: 'teal_indigo_mauve',
        colors: ['#111', '#333'],
        angle: 90,
        spread: 52,
      },
    })

    expect(resolveWallpaperThemeState(store, false)).toMatchObject({
      source: 'amber_mauve',
      brightness: 100,
      gradient: expect.objectContaining({ preset: 'amber_mauve' }),
    })
    expect(resolveWallpaperThemeState(store, true)).toMatchObject({
      source: 'teal_indigo_mauve',
      brightness: 82,
      gradient: expect.objectContaining({ preset: 'teal_indigo_mauve' }),
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
      source: 'amber_mauve',
      sourceDark: 'teal_indigo_mauve',
      texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
      textureDark: { type: WALLPAPER_TEXTURE.TILE, intensity: 40, params: {} },
    })

    store.commit({
      sourceDark: 'sky_mauve_blue',
      textureDark: { type: WALLPAPER_TEXTURE.ASCII, intensity: 55, params: {} },
    })

    expect(getWallpaperSavablePatch(store)).toEqual({
      sourceDark: 'sky_mauve_blue',
      textureDark: { type: WALLPAPER_TEXTURE.ASCII, intensity: 55, params: {} },
    })
  })
})
