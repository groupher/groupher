import THEME from '~/const/theme'

import useTwBelt from '~/hooks/useTwBelt'
import useTheme from '~/hooks/useTheme'

export default () => {
  const { cn } = useTwBelt()
  const { theme } = useTheme()

  return {
    wrapper: cn(
      'fixed h-full w-full top-0 will-change-transform trans-all-200',
      theme === THEME.DARK && 'brightness-75',
    ),
  }
}
