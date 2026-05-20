import { proxy } from 'valtio'

import { DEFAULT_THEME_PRESET } from '~/const/theme_preset'
import { resolveThemePreset } from '~/lib/themePreset'

import type { TInit, TStore } from './spec'

export default function ThemePresetStore(init: TInit = {}): TStore {
  const resolved = resolveThemePreset(init)

  const store = proxy({
    themePreset: init.themePreset ?? DEFAULT_THEME_PRESET,
    themeOverrides: init.themeOverrides ?? {},
    ...resolved,

    hydrate(source: TInit): void {
      const nextResolved = resolveThemePreset(source)

      store.themePreset = source.themePreset ?? DEFAULT_THEME_PRESET
      store.themeOverrides = source.themeOverrides ?? {}
      Object.assign(store, nextResolved)
    },
  })

  return store
}
