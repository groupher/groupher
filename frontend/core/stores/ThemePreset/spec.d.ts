import type { TResolvedThemePreset, TThemePresetSource } from '~/lib/themePreset'
import type { TThemePreset } from '~/spec'

export type TInit = TThemePresetSource

export type TStore = TResolvedThemePreset & {
  themePreset: TThemePreset | string
  themeOverrides: Record<string, unknown>
  hydrate: (source: TThemePresetSource) => void
}
