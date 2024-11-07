import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { isLightTheme } = useTheme()

  const { cn, bg, br } = useTwBelt()

  return {
    tracker: 'absolute bottom-6',
    wrapper: cn(
      'absolute bottom-6 left-1/2 align-both w-52 h-12 -ml-24 rounded-3xl z-50',
      'animate-fade-up animate-duration-500',
      isLightTheme && 'brightness-95',
      'gap-x-4 backdrop-blur-sm',
      br('divider'),
      bg('alphaBg'),
    ),
    dot: cn('size-2 circle opacity-65', bg('text.digest')),
    bar: cn('w-12 h-2 circle rounded-md', bg('text.digest')),
  }
}
