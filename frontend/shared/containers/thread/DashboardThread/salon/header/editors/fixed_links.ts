import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, fill } = useTwBelt()

  return {
    note: cn('text-xs bold-sm mb-4', fg('text.title')),
    items: 'column w-64 gap-y-3.5',
    item: 'row-center',
    title: cn('row-center w-20 text-xs', fg('text.title')),
    linkSlug: cn('text-xs', fg('text.hint')),
    arrowIcon: cn('size-3 rotate-180 ml-1.5', fill('text.digest')),
  }
}
