'use client'

import { type CSSProperties, createContext, type ReactNode, useEffect, useRef } from 'react'
import { useSnapshot } from 'valtio'

import THEME from '~/const/theme'
import { DEFAULT_TEXT_DIGEST, DEFAULT_TEXT_TITLE } from '~/const/theme_preset'
import { resolveThemePresetColor, resolveThemePresetPageBgCssVar } from '~/lib/themePreset'
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
    primaryColorDark,
    pageBg,
    pageBgDark,
    accentColor,
    accentColorDark,
    textTitle,
    textDigest,
  } = preset$
  const lightDefault = '#333333'
  const darkDefault = '#ffffff'
  const safeTextTitle = textTitle || DEFAULT_TEXT_TITLE
  const safeTextDigest = textDigest || DEFAULT_TEXT_DIGEST
  const lightPageBg = resolveThemePresetPageBgCssVar(THEME.LIGHT, pageBg)
  const darkPageBg = resolveThemePresetPageBgCssVar(THEME.DARK, pageBgDark)
  const lightPrimary = resolveThemePresetColor(primaryColor, lightDefault)
  const darkPrimary = resolveThemePresetColor(primaryColorDark, darkDefault)
  const lightAccent = resolveThemePresetColor(accentColor, lightDefault)
  const darkAccent = resolveThemePresetColor(accentColorDark, darkDefault)

  useEffect(() => {
    const root = document.documentElement

    root.style.setProperty('--color-primary-custom', lightPrimary)
    root.style.setProperty('--color-primary-custom-dark', darkPrimary)
    root.style.setProperty('--color-accent-custom', lightAccent)
    root.style.setProperty('--color-accent-custom-dark', darkAccent)
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
    darkPrimary,
    darkAccent,
    lightDefault,
    lightPageBg,
    lightPrimary,
    safeTextTitle,
    safeTextDigest,
    lightAccent,
  ])

  const style = {
    '--color-page-custom': lightPageBg,
    '--color-page-custom-dark': darkPageBg,
    '--color-primary-custom': lightPrimary,
    '--color-primary-custom-dark': darkPrimary,
    '--color-accent-custom': lightAccent,
    '--color-accent-custom-dark': darkAccent,
    '--color-title': safeTextTitle,
    '--color-digest': safeTextDigest,
  } as CSSProperties

  return <div style={style}>{children}</div>
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
