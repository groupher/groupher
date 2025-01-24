import useTheme from '~/hooks/useTheme'
import THEME from '~/const/theme'

import useSubstore from '~/hooks/useSubStore'

export default (): number => {
  const store = useSubstore('dashboard')
  const { theme } = useTheme()

  const { gossBlur, gossBlurDark } = store

  return theme === THEME.LIGHT ? gossBlur : gossBlurDark
}
