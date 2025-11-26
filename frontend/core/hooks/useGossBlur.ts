import THEME from '~/const/theme'
import useDashboard from '~/hooks/useDashboard'
import useTheme from '~/hooks/useTheme'

export default (): number => {
  const store = useDashboard()
  const { theme } = useTheme()

  const { gossBlur, gossBlurDark } = store

  return theme === THEME.LIGHT ? gossBlur : gossBlurDark
}
