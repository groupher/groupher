import { proxy } from 'valtio'

import { DEFAULT_THEME_PRESET } from '~/const/theme_preset'

import type { TInit, TStore } from './spec'

export default function ThemePresetStore(init: TInit = {}): TStore {
  const store = proxy({
    themePreset: init.themePreset ?? DEFAULT_THEME_PRESET,
    themePresetBase: init.themePresetBase ?? DEFAULT_THEME_PRESET,
    themeTokens: init.themeTokens ?? {},
    presetOptions: init.presetOptions ?? [],

    hydrate(source: TInit): void {
      store.themePreset = source.themePreset ?? DEFAULT_THEME_PRESET
      store.themePresetBase = source.themePresetBase ?? DEFAULT_THEME_PRESET
      store.themeTokens = source.themeTokens ?? {}
      if (source.presetOptions !== undefined) {
        store.presetOptions = source.presetOptions
      }
    },
    hydratePresetOptions(presetOptions): void {
      store.presetOptions = presetOptions
    },
  })

  return store as TStore
}
