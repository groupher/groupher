import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, bg, fill, fg, br } = useTwBelt()

  return {
    wrapper: cn(
      'column w-full mb-8 rounded-2xl relative border overflow-hidden',
      bg('alphaBg'),
      br('divider'),
    ),
    coverWrapper: cn('align-both w-full h-64', bg('hoverBg')),
    holdImg: cn('size-20 opacity-20', fill('digest')),
    content: 'grow px-3 py-2.5',
    hint: cn('absolute right-2 top-2 text-xs', fg('hint')),
    url: cn('text-sm', fg('hint')),
    title: cn('text-sm bold-sm line-clamp-1', fg('title')),
    desc: cn('text-sm line-clamp-2 opacity-65', fg('title')),
  }
}
