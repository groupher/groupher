import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg, br, primary } = useTwBelt()

  return {
    wrapper: cn('column w-full px-3 py-3 border rounded', br('divider'), bg('card')),
    header: 'row-between w-full',
    title: cn('text-xs bold-sm uppercase', fg('hint')),
    count: cn('align-both min-w-5 h-5 px-1 rounded-sm text-xs', primary('fg'), primary('bgLite')),
    empty: cn('row gap-2 mt-3 text-xs', fg('digest')),
    list: 'column gap-2 mt-3',
    item: cn('column gap-1 px-3 py-2 border rounded-sm', br('divider'), bg('pageBg')),
    itemTitle: cn('text-xs bold-sm truncate', fg('title')),
    itemMeta: cn('text-xs truncate', fg('hint')),
  }
}
