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
import { composeThemePresetCssVars } from '~/lib/themePreset'
import type { TResolvedThemePreset } from '~/spec'
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
  '--color-accent-custom',
  '--color-page-custom',
  '--color-title',
  '--color-digest',
  '--color-card',
  '--color-divider',
] as const

export const StoreContext = createContext<TStore | null>(null)
StoreContext.displayName = 'ThemePreset'

type TScopeProps = {
  children: ReactNode
  store: TStore
}

const ThemePresetScope = ({ children, store }: TScopeProps) => {
  const preset$ = useSnapshot(store)
  const { theme } = useTheme()
  const cssVars = useMemo(
    () =>
      preset$.themeTokens?.light && preset$.themeTokens?.dark
        ? composeThemePresetCssVars(preset$.themeTokens as TResolvedThemePreset, theme)
        : {},
    [preset$.themeTokens, theme],
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
      presetOptions: dsb$.themePresets,
    })
  }, [dsb$.themePreset, dsb$.themePresetBase, dsb$.themeTokens, dsb$.themePresets])

  return (
    <StoreContext.Provider value={storeRef.current}>
      <ThemePresetScope store={storeRef.current}>{children}</ThemePresetScope>
    </StoreContext.Provider>
  )
}
