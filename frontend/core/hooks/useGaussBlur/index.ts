import THEME from '~/const/theme'
import useDashboard from '~/hooks/useDashboard'
import useTheme from '~/hooks/useTheme'

export default function useGaussBlur(): number {
  const dsb$ = useDashboard()
  const { theme } = useTheme()

  const { gaussBlur, gaussBlurDark } = dsb$

  return theme === THEME.LIGHT ? gaussBlur : gaussBlurDark
}
