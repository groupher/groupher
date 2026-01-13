import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, bg, br, fg } = useTwBelt()

  return {
    wrapper: cn('column w-72 z-20 relative group'),
    paperMask: cn(
      'absolute top-0 -left-1 w-72 h-1/2 z-0 rounded -rotate-2 border',
      'group-hover:-rotate-3 trans-all-200',
      bg('alphaBg'),
      br('divider'),
    ),
    inner: cn('px-5 py-4 border rounded z-10 min-h-52', bg('card'), br('divider')),
    //
    header: 'column mb-4',
    topping: 'row-between',
    updateDate: cn('text-xs', fg('text.hint')),
    //
    title: cn('text-lg bold-sm mt-1.5', fg('text.title')),
    desc: cn('text-sm mt-1.5', fg('text.digest')),
    //
    items: 'column gap-3 mt-1.5 trans-all-200',
    item: cn('text-sm line-clamp-1 pointer', `hover:${fg('text.title')}`, fg('text.digest')),
    footer: cn('align-both h-8 w-full rounded mt-4', bg('hoverBg')),
  }
}
