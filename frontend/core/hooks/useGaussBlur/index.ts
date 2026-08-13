import useTheme from '~/hooks/useTheme'
import type { TResolvedThemePreset } from '~/spec'
import useThemePreset from '~/stores/ThemePreset/hooks'

/** Exposes gauss blur state and actions through the shared React hook boundary. */
export default function useGaussBlur(): number {
  const preset$ = useThemePreset()
  const { theme } = useTheme()
  const tokens = preset$.themeTokens as Partial<TResolvedThemePreset>

  return tokens[theme]?.gaussBlur ?? 100
}
