import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg, br } = useTwBelt()

  return {
    progress: cn('relative mt-2 h-7 overflow-hidden border rounded-sm', br('divider'), bg('card')),
    progressBar: 'abs-left-top h-full transition-all opacity-25 bg-rainbow-orange',
    progressMeta: cn('abs-full row-between px-3 text-xs', fg('digest')),
    state: cn('text-xs', fg('digest')),
    timingItem: cn('row gap-1 px-2 py-1 border rounded-sm', br('divider'), bg('card')),
    timingValue: fg('title'),
    timings: cn('row gap-2 mt-3 flex-wrap text-xs', fg('digest')),
    wrapper: cn('column w-full pb-4 mb-4 border-b', br('divider')),
  }
}
