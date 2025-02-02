import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, bg, fill, fg, br } = useTwBelt()

  return {
    wrapper: cn(
      'column w-96 mb-8 -ml-2 rounded-2xl relative border overflow-hidden',
      bg('alphaBg'),
      br('divider'),
    ),
    coverWrapper: cn('align-both w-full h-64', bg('hoverBg')),
    holdImg: cn('size-20 opacity-20', fill('text.digest')),
    content: 'grow px-3 py-2.5',
    hint: cn('absolute right-2 top-2 text-xs', fg('text.hint')),
    url: cn('text-sm', fg('text.hint')),
    title: cn('text-sm bold-sm line-clamp-1', fg('text.title')),
    desc: cn('text-sm line-clamp-2 opacity-65', fg('text.title')),
  }
}
