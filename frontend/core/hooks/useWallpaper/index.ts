'use client'

import { useMemo } from 'react'

import useTheme from '~/hooks/useTheme'
import {
  resolveCoreBg,
  resolveCoreBgRenderSpec,
  toCoreBgConfig,
  toCoreBgCssConfig,
} from '~/lib/coreBg/resolve'
import type { TCoreBgRenderSpec } from '~/lib/coreBg/spec'
import type { TWallpaperFmt } from '~/spec'
import { resolveWallpaperThemeState } from '~/stores/wallpaper/helper'
import useWallpaperDomain from '~/stores/wallpaper/hooks'
import type { TStore } from '~/stores/wallpaper/spec'
import type { TWallpaperThemeState } from '~/stores/wallpaper/spec'
import { getCoreBgRendererFallbackConfig } from '~/widgets/CoreBgRenderer/helper'

type TRet = { source: string; hasShadow: boolean } & TWallpaperFmt

export const toWallpaperCoreBgConfig = (
  store: Pick<TStore, keyof TWallpaperThemeState>,
): TWallpaperThemeState => ({ ...toCoreBgConfig(store), hasShadow: store.hasShadow })

const toWallpaperCoreBgCssConfig = (
  store: Pick<TStore, keyof TWallpaperThemeState>,
): TWallpaperThemeState => ({ ...toCoreBgCssConfig(store), hasShadow: store.hasShadow })

export const resolveWallpaper = (state: TWallpaperThemeState): TRet => {
  const parsed = resolveCoreBg(state)

  return {
    ...parsed,
    hasShadow: state.hasShadow,
  }
}

export const resolveWallpaperCoreBgRenderSpec = (
  state: TWallpaperThemeState,
): TCoreBgRenderSpec => {
  return resolveCoreBgRenderSpec(state, getCoreBgRendererFallbackConfig(state))
}

export default function useWallpaper(): TRet {
  const store = useWallpaperDomain()
  const { isDarkTheme } = useTheme()
  const state = toWallpaperCoreBgCssConfig(resolveWallpaperThemeState(store, isDarkTheme))

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

export function useWallpaperCoreBgRenderSpec(): TCoreBgRenderSpec {
  const store = useWallpaperDomain()
  const { isDarkTheme } = useTheme()
  const state = toWallpaperCoreBgConfig(resolveWallpaperThemeState(store, isDarkTheme))

  return useMemo(
    () => resolveWallpaperCoreBgRenderSpec(state),
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
