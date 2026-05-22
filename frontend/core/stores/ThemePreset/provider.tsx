'use client'

import {
  type CSSProperties,
  createContext,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import { useSnapshot } from 'valtio'

import useTheme from '~/hooks/useTheme'
import { buildThemePresetCssVars } from '~/lib/themePreset'
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
  '--color-title-dark',
  '--color-digest',
  '--color-digest-dark',
] as const

export const StoreContext = createContext<TStore | null>(null)
StoreContext.displayName = 'ThemePreset'

type TScopeProps = {
  children: ReactNode
  store: TStore
}

const ThemePresetScope = ({ children, store }: TScopeProps) => {
  const preset$ = useSnapshot(store)
  const { isLightTheme } = useTheme()
  const {
    pageBg,
    pageBgDark,
    primaryColor,
    primaryColorDark,
    accentColor,
    accentColorDark,
    textTitle,
    textTitleDark,
    textDigest,
    textDigestDark,
  } = preset$
  const cssVars = useMemo(
    () =>
      buildThemePresetCssVars(
        {
          pageBg,
          pageBgDark,
          primaryColor,
          primaryColorDark,
          accentColor,
          accentColorDark,
          textTitle,
          textTitleDark,
          textDigest,
          textDigestDark,
        },
        isLightTheme,
      ),
    [
      pageBg,
      pageBgDark,
      primaryColor,
      primaryColorDark,
      accentColor,
      accentColorDark,
      textTitle,
      textTitleDark,
      textDigest,
      textDigestDark,
      isLightTheme,
    ],
  )

  useEffect(() => {
    const root = document.documentElement

    for (const [key, value] of Object.entries(cssVars)) {
      root.style.setProperty(key, value)
    }

    return () => {
      for (const key of PRESET_CSS_VAR_KEYS) {
        root.style.removeProperty(key)
      }
    }
  }, [cssVars])

  const style = cssVars as CSSProperties

  return <div style={style}>{children}</div>
}

export default function Provider({ children, initData = EMPTY_INIT_DATA }: TProps) {
  const storeRef = useRef<TStore | null>(null)
  const dsb$ = useDashboard()

  storeRef.current ??= setupStore(initData)

  useEffect(() => {
    storeRef.current?.hydrate({
      themePreset: dsb$.themePreset,
      themePresetBase: dsb$.themePresetBase,
      themeTokens: dsb$.themeTokens,
      textTitle: dsb$.textTitle,
      textTitleDark: dsb$.textTitleDark,
      textDigest: dsb$.textDigest,
      textDigestDark: dsb$.textDigestDark,
      gaussBlur: dsb$.gaussBlur,
      gaussBlurDark: dsb$.gaussBlurDark,
    })
  }, [
    dsb$.themePreset,
    dsb$.themePresetBase,
    dsb$.themeTokens,
    dsb$.textTitle,
    dsb$.textTitleDark,
    dsb$.textDigest,
    dsb$.textDigestDark,
    dsb$.gaussBlur,
    dsb$.gaussBlurDark,
  ])

  return (
    <StoreContext.Provider value={storeRef.current}>
      <ThemePresetScope store={storeRef.current}>{children}</ThemePresetScope>
    </StoreContext.Provider>
  )
}
