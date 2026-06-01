import { equals } from 'ramda'

import { WALLPAPER_SAVABLE_STATE_KEYS } from '~/const/wallpaper'

import type { TStore, TWallpaperState, TWallpaperThemeState } from './spec'

const THEME_FIELD_DARK_MAP = {
  source: 'sourceDark',
  type: 'typeDark',
  hasPattern: 'hasPatternDark',
  patternId: 'patternIdDark',
  patternIntensity: 'patternIntensityDark',
  patternTone: 'patternToneDark',
  hasTexture: 'hasTextureDark',
  gradient: 'gradientDark',
  blurIntensity: 'blurIntensityDark',
  hasShadow: 'hasShadowDark',
  brightness: 'brightnessDark',
  saturation: 'saturationDark',
  texture: 'textureDark',
  bgSize: 'bgSizeDark',
} as const satisfies Partial<Record<keyof TWallpaperThemeState, keyof TWallpaperState>>

const THEME_STATE_KEYS = [
  'customWallpaper',
  'source',
  'type',
  'hasPattern',
  'patternId',
  'patternIntensity',
  'patternTone',
  'hasTexture',
  'gradient',
  'blurIntensity',
  'hasShadow',
  'brightness',
  'saturation',
  'texture',
  'bgSize',
] as const satisfies readonly (keyof TWallpaperThemeState)[]

export const resolveWallpaperThemeState = (
  store: Pick<TStore, keyof TWallpaperState>,
  isDarkTheme: boolean,
): TWallpaperThemeState => {
  const state = {} as TWallpaperThemeState
  const mutableState = state as Record<keyof TWallpaperThemeState, unknown>

  for (const key of THEME_STATE_KEYS) {
    const mappedKey = isDarkTheme ? THEME_FIELD_DARK_MAP[key] : undefined
    mutableState[key] = mappedKey ? store[mappedKey] : store[key]
  }

  return state
}

export const toWallpaperThemePatch = (
  patch: Partial<TWallpaperThemeState>,
  isDarkTheme: boolean,
): Partial<TWallpaperState> => {
  if (!isDarkTheme) return patch as Partial<TWallpaperState>

  const themedPatch: Partial<TWallpaperState> = {}
  const mutablePatch = themedPatch as Record<keyof TWallpaperState, unknown>

  for (const [key, value] of Object.entries(patch) as [
    keyof TWallpaperThemeState,
    TWallpaperThemeState[keyof TWallpaperThemeState],
  ][]) {
    const mappedKey = THEME_FIELD_DARK_MAP[key]
    mutablePatch[mappedKey ?? key] = value
  }

  return themedPatch
}

export const getWallpaperSavablePatch = (store: TStore): Partial<TWallpaperState> => {
  const patch: Partial<TWallpaperState> = {}
  const mutablePatch = patch as Record<keyof TWallpaperState, unknown>

  for (const key of WALLPAPER_SAVABLE_STATE_KEYS) {
    if (!equals(store.original[key], store[key])) {
      mutablePatch[key] = store[key]
    }
  }

  return patch
}
