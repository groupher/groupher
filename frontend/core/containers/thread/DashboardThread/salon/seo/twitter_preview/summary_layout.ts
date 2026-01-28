import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, br, fill } = useTwBelt()

  return {
    wrapper: cn(
      'row-center relative mb-8 rounded-lg w-full h-28 border overflow-hidden',
      br('divider'),
      bg('alphaBg'),
    ),
    coverWrapper: cn('align-both size-28', bg('hoverBg')),
    holdImg: cn('size-10 opacity-20', fill('digest')),
    content: 'grow px-3 py-2.5',
    hint: cn('absolute right-2 top-2 text-xs', fg('hint')),
    url: cn('text-sm', fg('hint')),
    title: cn('text-sm bold-sm line-clamp-1', fg('title')),
    desc: cn('text-sm line-clamp-2 opacity-65', fg('title')),
  }
}
