import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, shadow } = useTwBelt()

  return {
    wrapper: cn(
      'column p-5 w-[420px] h-[450px] rounded-xl z-20',
      'absolute top-40 left-2.5',
      fg('text.digest'),
      bg('htmlBg'),
      shadow('lg'),
    ),
  }
}
