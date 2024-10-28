import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { isLightTheme } = useTheme()
  const { cn, fg, bg, br, shadow } = useTwBelt()

  return {
    wrapper: cn(
      'column p-5 w-[420px] h-[450px] rounded-xl z-20 border border-transparent',
      'absolute top-40 left-2.5',
      fg('text.digest'),
      bg('cardBg'),
      shadow('lg'),
      !isLightTheme && br('divider'),
    ),
  }
}
