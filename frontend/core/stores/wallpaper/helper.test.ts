import { WALLPAPER_TYPE } from '~/const/wallpaper'
import { GRADIENT_RENDERER, WALLPAPER_TEXTURE } from '~/lib/wallpaperMesh'

import setupStore from '.'
import { getWallpaperSavablePatch, pickWallpaperThemeState, toWallpaperThemePatch } from './helper'

describe('stores/wallpaper/helper', () => {
  it('resolves the active light or dark wallpaper state', () => {
    const store = setupStore({
      light: {
        source: 'amber_mauve',
        brightness: 100,
        gradient: {
          version: 2,
          renderer: GRADIENT_RENDERER.LINEAR,
          preset: 'amber_mauve',
          colors: ['#fff', '#ddd'],
          angle: 180,
          spread: 52,
        },
      },
      dark: {
        source: 'teal_indigo_mauve',
        brightness: 82,
        gradient: {
          version: 2,
          renderer: GRADIENT_RENDERER.LINEAR,
          preset: 'teal_indigo_mauve',
          colors: ['#111', '#333'],
          angle: 90,
          spread: 52,
        },
      },
    })

    expect(pickWallpaperThemeState(store, false)).toMatchObject({
      source: 'amber_mauve',
      brightness: 100,
      gradient: expect.objectContaining({ preset: 'amber_mauve' }),
    })
    expect(pickWallpaperThemeState(store, true)).toMatchObject({
      source: 'teal_indigo_mauve',
      brightness: 82,
      gradient: expect.objectContaining({ preset: 'teal_indigo_mauve' }),
    })
  })

  it('wraps current-theme edit patches in the active theme', () => {
    expect(toWallpaperThemePatch({ source: 'orange' }, false)).toEqual({
      light: { source: 'orange' },
    })
    expect(toWallpaperThemePatch({ source: 'orange', type: WALLPAPER_TYPE.PATTERN }, true)).toEqual(
      {
        dark: {
          source: 'orange',
          type: WALLPAPER_TYPE.PATTERN,
        },
      },
    )
  })

  it('builds a sparse savable patch from original to current state', () => {
    const store = setupStore({
      light: {
        source: 'amber_mauve',
        texture: { type: WALLPAPER_TEXTURE.NOISE, intensity: 0, params: {} },
      },
      dark: {
        source: 'teal_indigo_mauve',
        texture: { type: WALLPAPER_TEXTURE.TILE, intensity: 40, params: {} },
      },
    })

    store.commit({
      dark: {
        source: 'sky_mauve_blue',
        texture: { type: WALLPAPER_TEXTURE.ASCII, intensity: 55, params: {} },
      },
    })

    expect(getWallpaperSavablePatch(store)).toEqual({
      dark: {
        source: 'sky_mauve_blue',
        texture: { type: WALLPAPER_TEXTURE.ASCII, intensity: 55, params: {} },
      },
    })
  })
})
