import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, shadow } = useTwBelt()

  return {
    wrapper: cn(
      'absolute bottom-40 -right-16 w-44 h-20 p-2.5 z-50 rounded-xl text-xs',
      fg('text.digest'),
      bg('htmlBg'),
      shadow('lg'),
    ),

    user: 'row-center mb-2.5',
    avatar: 'size-4 rounded-md',
    nickname: cn('text-xs ml-1.5', fg('text.title')),
  }
}
