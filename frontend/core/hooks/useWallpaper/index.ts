'use client'

import { useMemo } from 'react'

import useTheme from '~/hooks/useTheme'
import { composeBgCss, composeBgRenderSpec } from '~/lib/bg'
import type { TBgRenderSpec } from '~/lib/bg'
import type { TWallpaperFmt } from '~/spec'
import { pickWallpaperThemeState } from '~/stores/wallpaper/helper'
import useWallpaperDomain from '~/stores/wallpaper/hooks'
import type { TWallpaperThemeState } from '~/stores/wallpaper/spec'

type TRet = { source: string } & TWallpaperFmt

const toWallpaperBgCssConfig = (store: TWallpaperThemeState): TWallpaperThemeState => ({
  ...store,
  texture: { ...store.texture, enabled: false, intensity: 0 },
})

/**
 * Compose wallpaper CSS fallback output from one theme branch.
 *
 * This reuses `composeBgCss` for the actual background string.
 *
 * @example
 * const css = composeWallpaperBgCss(pickWallpaperThemeState(store, isDarkTheme))
 */
export const composeWallpaperBgCss = (state: TWallpaperThemeState): TRet => {
  const parsed = composeBgCss(state)

  return parsed
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
    [state.source, state.pattern, state.effect, state.gradient, state.customWallpaper, state.type],
  )
}

export function useWallpaperBgRenderSpec(): TBgRenderSpec {
  const store = useWallpaperDomain()
  const { isDarkTheme } = useTheme()
  const state = pickWallpaperThemeState(store, isDarkTheme)

  return useMemo(
    () => adaptWallpaperBgRenderSpec(state),
    [
      state.source,
      state.pattern,
      state.effect,
      state.texture,
      state.gradient,
      state.customWallpaper,
      state.type,
    ],
  )
}
