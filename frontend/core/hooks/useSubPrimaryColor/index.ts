import type { TColorName } from '~/spec'
import useThemePreset from '~/stores/ThemePreset/hooks'

export default function useSubPrimaryColor(): TColorName {
  const preset$ = useThemePreset()

  return preset$.subPrimaryColor
}
