import useTheme from '~/hooks/useTheme'
import type { TResolvedThemePreset } from '~/spec'
import useThemePreset from '~/stores/ThemePreset/hooks'

export default function useGaussBlur(): number {
  const preset$ = useThemePreset()
  const { theme } = useTheme()
  const tokens = preset$.themeTokens as Partial<TResolvedThemePreset>

  return tokens[theme]?.gaussBlur ?? 100
}
