import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { isLightTheme } = useTheme()
  const { cn, shadow, fill, br } = useTwBelt()

  return {
    wrapper: 'relative group',
    button: cn(
      isLightTheme ? shadow('xl') : shadow('lg'),
      !isLightTheme && cn('border-2', br('digest')),
    ),
    background: cn(
      'relative align-center rounded-xl overflow-hidden shadow-inner',
      isLightTheme ? 'p-1' : 'p-0.5',
    ),

    arrow: cn(
      'absolute right-3 top-3 size-4.5 rotate-180 hidden group-hover:block trans-all-100',
      'z-20',
      isLightTheme && 'opacity-65',
      isLightTheme ? fill('button.fg') : fill('digest'),
    ),
  }
}
