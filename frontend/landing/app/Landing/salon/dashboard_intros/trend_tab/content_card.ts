import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, shadow, br } = useTwBelt()

  return {
    wrapper: cn(
      'column p-5 rounded-md z-20 border w-[420px] h-[460px]',
      'absolute bottom-40 left-36',
      br('divider'),
      fg('text.digest'),
      bg('htmlBg'),
      shadow('md'),
    ),
  }
}
