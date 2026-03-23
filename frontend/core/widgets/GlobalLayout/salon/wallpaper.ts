import THEME from '~/const/theme'
import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn } = useTwBelt()
  const { theme } = useTheme()

  return {
    wrapper: cn(
      'fixed h-full w-full top-0 will-change-transform trans-all-200',
      theme === THEME.DARK && 'brightness-75',
    ),
  }
}
