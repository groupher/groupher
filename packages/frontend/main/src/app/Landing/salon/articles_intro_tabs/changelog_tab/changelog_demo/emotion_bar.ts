import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, shadow } = useTwBelt()

  return {
    wrapper: cn(
      'align-both absolute bottom-32 right-16 rounded-xl w-64 gap-x-4 py-2',
      bg('htmlBg'),
      shadow('lg'),
    ),
    item: 'align-both',
    emoji: 'size-4 opacity-80',
    count: cn('text-base ml-1.5 bold-sm', fg('text.digest')),
  }
}
