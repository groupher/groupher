'use client'

import { type CSSProperties, createContext, type ReactNode, useEffect, useRef } from 'react'
import { useSnapshot } from 'valtio'

import { getDefaultCustomColor } from '~/const/colors'
import THEME from '~/const/theme'
import { DEFAULT_TEXT_DIGEST, DEFAULT_TEXT_TITLE } from '~/const/theme_preset'
import { resolveThemePresetPageBgCssVar } from '~/lib/themePreset'
import useDashboard from '~/stores/dashboard/hooks'

import setupStore from '.'
import type { TInit, TStore } from './spec'

type TProps = {
  children: ReactNode
  initData?: TInit
}

const EMPTY_INIT_DATA: TInit = {}

// Keep this list in sync with the CSS variables written by ThemePresetScope so
// unmounting the preset provider does not leave stale theme values on <html>.
const PRESET_CSS_VAR_KEYS = [
  '--color-primary-custom',
  '--color-primary-custom-dark',
  '--color-accent-custom',
  '--color-accent-custom-dark',
  '--color-page-custom',
  '--color-page-custom-dark',
  '--color-title',
  '--color-digest',
] as const

export const StoreContext = createContext<TStore | null>(null)
StoreContext.displayName = 'ThemePreset'

type TScopeProps = {
  children: ReactNode
  store: TStore
}

const ThemePresetScope = ({ children, store }: TScopeProps) => {
  const preset$ = useSnapshot(store)
  const {
    primaryColor,
    pageBg,
    pageBgDark,
    pageCustomBg,
    pageCustomBgDark,
    pageCustomIntensity,
    pageCustomIntensityDark,
    primaryCustomColor,
    primaryCustomColorDark,
    accentColor,
    accentCustomColor,
    accentCustomColorDark,
    textTitle,
    textDigest,
  } = preset$
  const lightDefault = getDefaultCustomColor(THEME.LIGHT)
  const darkDefault = getDefaultCustomColor(THEME.DARK)
  const safeTextTitle = textTitle || DEFAULT_TEXT_TITLE
  const safeTextDigest = textDigest || DEFAULT_TEXT_DIGEST
  const lightPageBg = resolveThemePresetPageBgCssVar(
    THEME.LIGHT,
    pageBg,
    pageCustomBg,
    pageCustomIntensity,
  )
  const darkPageBg = resolveThemePresetPageBgCssVar(
    THEME.DARK,
    pageBgDark,
    pageCustomBgDark,
    pageCustomIntensityDark,
  )

  useEffect(() => {
    const root = document.documentElement

    root.style.setProperty('--color-primary-custom', primaryCustomColor || lightDefault)
    root.style.setProperty('--color-primary-custom-dark', primaryCustomColorDark || darkDefault)
    root.style.setProperty('--color-accent-custom', accentCustomColor || lightDefault)
    root.style.setProperty('--color-accent-custom-dark', accentCustomColorDark || darkDefault)
    root.style.setProperty('--color-page-custom', lightPageBg)
    root.style.setProperty('--color-page-custom-dark', darkPageBg)
    root.style.setProperty('--color-title', safeTextTitle)
    root.style.setProperty('--color-digest', safeTextDigest)

    return () => {
      for (const key of PRESET_CSS_VAR_KEYS) {
        root.style.removeProperty(key)
      }
    }
  }, [
    darkDefault,
    darkPageBg,
    lightDefault,
    lightPageBg,
    primaryCustomColor,
    primaryCustomColorDark,
    safeTextTitle,
    safeTextDigest,
    accentCustomColor,
    accentCustomColorDark,
  ])

  const style = {
    '--color-page-custom': lightPageBg,
    '--color-page-custom-dark': darkPageBg,
    '--color-primary-custom': primaryCustomColor || lightDefault,
    '--color-primary-custom-dark': primaryCustomColorDark || darkDefault,
    '--color-accent-custom': accentCustomColor || lightDefault,
    '--color-accent-custom-dark': accentCustomColorDark || darkDefault,
    '--color-title': safeTextTitle,
    '--color-digest': safeTextDigest,
  } as CSSProperties

  return (
    <div data-primary-color={primaryColor} data-accent-color={accentColor} style={style}>
      {children}
    </div>
  )
}

export default function Provider({ children, initData = EMPTY_INIT_DATA }: TProps) {
  const storeRef = useRef<TStore | null>(null)
  const dsb$ = useDashboard()

  storeRef.current ??= setupStore(initData)

  useEffect(() => {
    storeRef.current?.hydrate({
      themePreset: dsb$.themePreset,
      themeTokens: dsb$.themeTokens,
      textTitle: dsb$.textTitle,
      textDigest: dsb$.textDigest,
      gaussBlur: dsb$.gaussBlur,
      gaussBlurDark: dsb$.gaussBlurDark,
    })
  }, [
    dsb$.themePreset,
    dsb$.themeTokens,
    dsb$.textTitle,
    dsb$.textDigest,
    dsb$.gaussBlur,
    dsb$.gaussBlurDark,
  ])

  return (
    <StoreContext.Provider value={storeRef.current}>
      <ThemePresetScope store={storeRef.current}>{children}</ThemePresetScope>
    </StoreContext.Provider>
  )
}
