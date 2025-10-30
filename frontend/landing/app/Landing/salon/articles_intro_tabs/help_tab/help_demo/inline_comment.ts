import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { isLightTheme } = useTheme()
  const { cn, fg, bg, br, shadow } = useTwBelt()

  return {
    wrapper: cn(
      'absolute bottom-40 -right-16 w-44 h-20 p-2.5 z-50 rounded-xl text-xs',
      !isLightTheme && cn('border', br('divider')),
      fg('text.digest'),
      bg('card'),
      shadow('lg'),
    ),

    user: 'row-center mb-2.5',
    avatar: 'size-4 rounded-md',
    nickname: cn('text-xs ml-1.5', fg('text.title')),
  }
}
