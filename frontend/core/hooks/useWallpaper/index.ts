'use client'

import { useMemo } from 'react'

import useTheme from '~/hooks/useTheme'
import { composeBgCss, composeBgRenderSpec, toBgConfig, toBgCssConfig } from '~/lib/bg'
import type { TBgRenderSpec } from '~/lib/bg'
import type { TWallpaperFmt } from '~/spec'
import { pickWallpaperThemeState } from '~/stores/wallpaper/helper'
import useWallpaperDomain from '~/stores/wallpaper/hooks'
import type { TWallpaperThemeState } from '~/stores/wallpaper/spec'

type TRet = { source: string; hasShadow: boolean } & TWallpaperFmt

export const toWallpaperBgConfig = (store: TWallpaperThemeState): TWallpaperThemeState => ({
  ...toBgConfig(store),
  hasShadow: store.hasShadow,
})

const toWallpaperBgCssConfig = (store: TWallpaperThemeState): TWallpaperThemeState => ({
  ...toBgCssConfig(store),
  hasShadow: store.hasShadow,
})

/**
 * Compose wallpaper CSS fallback output from one theme branch.
 *
 * This keeps wallpaper-only fields such as `hasShadow` outside the shared Bg
 * composer while reusing `composeBgCss` for the actual background string.
 *
 * @example
 * const css = composeWallpaperBgCss(pickWallpaperThemeState(store, isDarkTheme))
 */
export const composeWallpaperBgCss = (state: TWallpaperThemeState): TRet => {
  const parsed = composeBgCss(state)

  return {
    ...parsed,
    hasShadow: state.hasShadow,
  }
}

/**
 * Adapt one wallpaper theme branch to the shared Bg render spec.
 *
 * @example
 * const renderSpec = adaptWallpaperBgRenderSpec(wallpaper.light)
 */
export const adaptWallpaperBgRenderSpec = (state: TWallpaperThemeState): TBgRenderSpec => {
  return composeBgRenderSpec(state)
}

export default function useWallpaper(): TRet {
  const store = useWallpaperDomain()
  const { isDarkTheme } = useTheme()
  const state = toWallpaperBgCssConfig(pickWallpaperThemeState(store, isDarkTheme))

  return useMemo(
    () => composeWallpaperBgCss(state),
    [
      state.source,
      state.hasPattern,
      state.patternId,
      state.patternIntensity,
      state.patternTone,
      state.blurIntensity,
      state.hasShadow,
      state.brightness,
      state.saturation,
      state.gradient,
      state.customWallpaper,
      state.type,
    ],
  )
}

export function useWallpaperBgRenderSpec(): TBgRenderSpec {
  const store = useWallpaperDomain()
  const { isDarkTheme } = useTheme()
  const state = toWallpaperBgConfig(pickWallpaperThemeState(store, isDarkTheme))

  return useMemo(
    () => adaptWallpaperBgRenderSpec(state),
    [
      state.source,
      state.hasPattern,
      state.patternId,
      state.patternIntensity,
      state.patternTone,
      state.hasTexture,
      state.blurIntensity,
      state.hasShadow,
      state.brightness,
      state.saturation,
      state.texture,
      state.gradient,
      state.customWallpaper,
      state.type,
    ],
  )
}
