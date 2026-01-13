import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, br } = useTwBelt()

  return {
    wrapper: cn(
      'relative w-full pt-2.5 pb-3 px-2.5 mb-2.5 rounded-md border border-transparent',
      `hover:${br('divider')}`,
      bg('card'),
    ),
    header: 'row-between mb-2.5',
    title: cn('text-base w-full line-clamp-2', fg('text.title')),
    desc: cn('text-xs line-clamp-1', fg('text.digest')),
    footer: 'row-between text-xs mt-2',
  }
}
