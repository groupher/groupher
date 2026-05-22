import type { TResolvedThemePreset, TThemePresetSource } from '~/lib/themePreset'
import type { TThemePreset, TThemePresetOption } from '~/spec'

export type TInit = TThemePresetSource & {
  presetOptions?: readonly TThemePresetOption[]
}

export type TStore = TResolvedThemePreset & {
  themePreset: TThemePreset | string
  themePresetBase: TThemePreset | string
  themeTokens: Record<string, unknown>
  presetOptions: readonly TThemePresetOption[]
  hydrate: (source: TThemePresetSource) => void
  hydratePresetOptions: (presetOptions: readonly TThemePresetOption[]) => void
}
