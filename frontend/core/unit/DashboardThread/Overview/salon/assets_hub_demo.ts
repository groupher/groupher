import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg, br } = useTwBelt()

  return {
    wrapper: cn('column w-160 mt-8 pt-6 border-t', br('divider')),
    header: 'row-between w-full',
    title: cn('text-sm bold-sm', fg('title')),
    desc: cn('text-xs mt-1', fg('hint')),
    state: cn('mt-4 text-xs', fg('digest')),
    progress: cn('relative mt-3 h-7 overflow-hidden border rounded-sm', br('divider'), bg('card')),
    progressBar: 'abs-left-top h-full transition-all opacity-25 bg-rainbow-orange',
    progressMeta: cn('abs-full row-between px-3 text-xs', fg('digest')),
    timings: cn('row gap-2 mt-3 flex-wrap text-xs', fg('digest')),
    timingItem: cn('row gap-1 px-2 py-1 border rounded-sm', br('divider'), bg('card')),
    timingValue: fg('title'),
    list: 'column gap-2 mt-4 w-full',
    empty: cn('px-4 py-5 text-xs border rounded text-center', fg('hint'), br('divider')),
    item: cn('row-between w-full px-4 py-3 border rounded', br('divider'), bg('card')),
    itemMain: 'column min-w-0',
    fileName: cn('text-sm truncate max-w-96', fg('title')),
    meta: cn('text-xs mt-1', fg('hint')),
    itemSub: cn('text-xs ml-4 shrink-0', fg('digest')),
  }
}
