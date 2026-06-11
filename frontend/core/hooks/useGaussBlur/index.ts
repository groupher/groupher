import THEME from '~/const/theme'
import useTheme from '~/hooks/useTheme'
import { getThemePresetSection } from '~/lib/themePreset'
import type { TResolvedThemePreset } from '~/spec'
import useThemePreset from '~/stores/ThemePreset/hooks'

export default function useGaussBlur(): number {
  const preset$ = useThemePreset()
  const { theme } = useTheme()
  const tokens = preset$.themeTokens as TResolvedThemePreset

  if (!tokens.light || !tokens.dark) return 100

  return getThemePresetSection(tokens, theme || THEME.LIGHT).gaussBlur
}
