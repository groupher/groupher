import type { TThemePresetOption, TThemePresetTokens } from '../spec'

export type TPresetListItem =
  | {
      type: 'preset'
      preset: TThemePresetOption
    }
  | {
      type: 'forkedFrom'
    }

export type TProps = {
  activePreset: string
  activePresetBase: string
  presetOptions: readonly TThemePresetOption[]
  customTokens: TThemePresetTokens
  showForkRelation: boolean
  onSelect: (preset: TThemePresetOption) => void
}
