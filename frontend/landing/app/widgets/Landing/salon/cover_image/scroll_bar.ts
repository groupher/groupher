import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { isLightTheme } = useTheme()

  const { cn, bg, br } = useTwBelt()

  return {
    tracker: 'absolute bottom-6',
    wrapper: cn(
      'absolute bottom-6 left-1/2 align-both w-52 h-12 -ml-24 rounded-3xl z-50',
      'animate-fade-up animate-duration-500',
      isLightTheme && 'brightness-95',
      'gap-x-4 backdrop-blur-sm opacity-20',
      br('divider'),
      bg('alphaBg'),
    ),
    dot: cn('relative size-2 circle opacity-65 trans-all-200 pointer', bg('text.digest')),
    dotBox: 'align-both absolute w-5 h-5 -top-1.5 -left-1.5 circle pointer',
    dotActive: 'w-12 rounded-md opacity-100',
  }
}
