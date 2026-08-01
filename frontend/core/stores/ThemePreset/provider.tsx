'use client'

import { type ReactNode, useEffect, useMemo, useRef } from 'react'
import { useSnapshot } from 'valtio'

import { serializeCommunityThemePresetCss } from '~/lib/themePreset'
import type { TResolvedThemePreset } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import setupStore from '.'
import { StoreContext } from './context'
import type { TInit, TStore } from './spec'

type TProps = {
  children: ReactNode
  initData?: TInit
}

const EMPTY_INIT_DATA: TInit = {}

type TScopeProps = {
  children: ReactNode
  store: TStore
}

const ThemePresetScope = ({ children, store }: TScopeProps) => {
  const preset$ = useSnapshot(store)
  const cssText = useMemo(
    () =>
      preset$.themeTokens?.light && preset$.themeTokens?.dark
        ? serializeCommunityThemePresetCss(preset$.themeTokens as TResolvedThemePreset)
        : '',
    [preset$.themeTokens],
  )

  return (
    <>
      {cssText && (
        <style
          // oxlint-disable-next-line react/no-danger -- Preset variables need both theme branches before hydration.
          dangerouslySetInnerHTML={{ __html: cssText }}
        />
      )}
      {children}
    </>
  )
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
