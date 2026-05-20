import type { TColorName } from '~/spec'
import useThemePreset from '~/stores/ThemePreset/hooks'

export default function useAccentColor(): TColorName {
  const preset$ = useThemePreset()

  return preset$.accentColor
}
