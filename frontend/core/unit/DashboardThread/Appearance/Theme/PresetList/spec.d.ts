import type { TThemePresetOption, TThemePresetOverwrite } from '../spec'

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
  hasCustomPreset: boolean
  customOverwrite: TThemePresetOverwrite
  showForkRelation: boolean
  onSelect: (preset: TThemePresetOption) => void
}
