import { pick } from 'ramda'
import { useMemo } from 'react'

import { COLOR, PAGE_BG_COLOR_HEX, PAGE_BG_DEFAULT } from '~/const/colors'
import THEME from '~/const/theme'
import { getPageBgCustomColor, getPageBgCustomParamsFromHex } from '~/lib/color'

import {
  COLORED_PAGE_BG,
  PAGE_BG_DRAFT_KEYS,
  PAGE_BG_THEME_FIELDS,
  SOLARIZED_PAGE_BG,
} from './constant'

export type TPageBgDraft = {
  pageBg: string
  pageBgDark: string
  pageCustomBg: number
  pageCustomBgDark: number
  pageCustomIntensity: number
  pageCustomIntensityDark: number
}

const pickPageBgDraft = (source: TPageBgDraft): TPageBgDraft =>
  pick(PAGE_BG_DRAFT_KEYS, source) as TPageBgDraft

export const usePageBgDraft = (source: TPageBgDraft): TPageBgDraft =>
  useMemo(
    () => pickPageBgDraft(source),
    [
      source.pageBg,
      source.pageBgDark,
      source.pageCustomBg,
      source.pageCustomBgDark,
      source.pageCustomIntensity,
      source.pageCustomIntensityDark,
    ],
  )

export const resolveRawBg = (draft: TPageBgDraft, isLightTheme: boolean) => {
  const currentPageBg = isLightTheme ? draft.pageBg : draft.pageBgDark

  if (currentPageBg === COLOR.CUSTOM) {
    return isLightTheme
      ? getPageBgCustomColor(THEME.LIGHT, draft.pageCustomBg, draft.pageCustomIntensity)
      : getPageBgCustomColor(THEME.DARK, draft.pageCustomBgDark, draft.pageCustomIntensityDark)
  }

  return PAGE_BG_COLOR_HEX[currentPageBg] || ''
}

const resolveInitialPreset = (current: string, original: string, fallback: string): string => {
  if (current !== COLOR.CUSTOM) return current
  if (original !== COLOR.CUSTOM) return original
  return fallback
}

export const resolveLastPresetByTheme = (draft: TPageBgDraft, originalDraft: TPageBgDraft) => ({
  light: resolveInitialPreset(draft.pageBg, originalDraft.pageBg, PAGE_BG_DEFAULT[THEME.LIGHT]),
  dark: resolveInitialPreset(
    draft.pageBgDark,
    originalDraft.pageBgDark,
    PAGE_BG_DEFAULT[THEME.DARK],
  ),
})

export const getThemePageBgState = (draft: TPageBgDraft, theme: string) => {
  const { pageBg, pageCustomBg, pageCustomIntensity } = PAGE_BG_THEME_FIELDS[theme]

  return {
    pageBg: draft[pageBg],
    pageCustomBg: draft[pageCustomBg],
    pageCustomIntensity: draft[pageCustomIntensity],
  }
}

export const resolveCustomInitPatch = (draft: TPageBgDraft, theme: string) => {
  const { pageBg } = getThemePageBgState(draft, theme)
  if (pageBg === COLOR.CUSTOM) return null

  const fallbackPresetBg = SOLARIZED_PAGE_BG[theme]
  const sourcePresetBg = COLORED_PAGE_BG[theme].has(pageBg) ? pageBg : fallbackPresetBg
  const sourceHex = PAGE_BG_COLOR_HEX[sourcePresetBg] || PAGE_BG_COLOR_HEX[fallbackPresetBg]
  const { hue, intensity } = getPageBgCustomParamsFromHex(sourceHex, theme)
  const { pageBg: pageBgField, pageCustomBg, pageCustomIntensity } = PAGE_BG_THEME_FIELDS[theme]

  return {
    [pageBgField]: COLOR.CUSTOM,
    [pageCustomBg]: hue,
    [pageCustomIntensity]: intensity,
  } as Partial<TPageBgDraft>
}

export const resolvePresetRestorePatch = (lightPreset: string, darkPreset: string) => ({
  pageBg: lightPreset,
  pageBgDark: darkPreset,
})
