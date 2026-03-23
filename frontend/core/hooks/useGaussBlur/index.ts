import THEME from '~/const/theme'
import useDashboard from '~/stores/dashboard/hooks'
import useTheme from '~/hooks/useTheme'

export default function useGaussBlur(): number {
  const dsb$ = useDashboard()
  const { theme } = useTheme()

  const { gaussBlur, gaussBlurDark } = dsb$

  return theme === THEME.LIGHT ? gaussBlur : gaussBlurDark
}
