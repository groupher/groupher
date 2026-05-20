import THEME from '~/const/theme'
import useTheme from '~/hooks/useTheme'
import useThemePreset from '~/stores/ThemePreset/hooks'

export default function useGaussBlur(): number {
  const preset$ = useThemePreset()
  const { theme } = useTheme()

  const { gaussBlur, gaussBlurDark } = preset$

  return theme === THEME.LIGHT ? gaussBlur : gaussBlurDark
}
