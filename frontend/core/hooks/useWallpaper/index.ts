'use client'

import { useMemo } from 'react'

import useTheme from '~/hooks/useTheme'
import { resolveBg, resolveBgRenderSpec, toBgConfig, toBgCssConfig } from '~/lib/bg/resolve'
import type { TBgRenderSpec } from '~/lib/bg/spec'
import type { TWallpaperFmt } from '~/spec'
import { resolveWallpaperThemeState } from '~/stores/wallpaper/helper'
import useWallpaperDomain from '~/stores/wallpaper/hooks'
import type { TStore } from '~/stores/wallpaper/spec'
import type { TWallpaperThemeState } from '~/stores/wallpaper/spec'
import { getBgRendererFallbackConfig } from '~/widgets/BgRenderer/helper'

type TRet = { source: string; hasShadow: boolean } & TWallpaperFmt

export const toWallpaperBgConfig = (
  store: Pick<TStore, keyof TWallpaperThemeState>,
): TWallpaperThemeState => ({ ...toBgConfig(store), hasShadow: store.hasShadow })

const toWallpaperBgCssConfig = (
  store: Pick<TStore, keyof TWallpaperThemeState>,
): TWallpaperThemeState => ({ ...toBgCssConfig(store), hasShadow: store.hasShadow })

export const resolveWallpaper = (state: TWallpaperThemeState): TRet => {
  const parsed = resolveBg(state)

  return {
    ...parsed,
    hasShadow: state.hasShadow,
  }
}

export const resolveWallpaperBgRenderSpec = (state: TWallpaperThemeState): TBgRenderSpec => {
  return resolveBgRenderSpec(state, getBgRendererFallbackConfig(state))
}

export default function useWallpaper(): TRet {
  const store = useWallpaperDomain()
  const { isDarkTheme } = useTheme()
  const state = toWallpaperBgCssConfig(resolveWallpaperThemeState(store, isDarkTheme))

  return useMemo(
    () => resolveWallpaper(state),
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
      state.bgSize,
    ],
  )
}

export function useWallpaperBgRenderSpec(): TBgRenderSpec {
  const store = useWallpaperDomain()
  const { isDarkTheme } = useTheme()
  const state = toWallpaperBgConfig(resolveWallpaperThemeState(store, isDarkTheme))

  return useMemo(
    () => resolveWallpaperBgRenderSpec(state),
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
      state.bgSize,
    ],
  )
}
