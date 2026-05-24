import type { TResolvedThemePreset, TThemePreset, TThemePresetOption } from '~/spec'

export type TInit = {
  themePreset?: TThemePreset | string
  themePresetBase?: TThemePreset | string | null
  themeTokens?: Partial<TResolvedThemePreset> | null
  presetOptions?: readonly TThemePresetOption[]
}

export type TStore = Partial<TResolvedThemePreset> & {
  themePreset: TThemePreset | string
  themePresetBase: TThemePreset | string
  themeTokens: Partial<TResolvedThemePreset>
  presetOptions: readonly TThemePresetOption[]
  hydrate: (source: TInit) => void
  hydratePresetOptions: (presetOptions: readonly TThemePresetOption[]) => void
}
