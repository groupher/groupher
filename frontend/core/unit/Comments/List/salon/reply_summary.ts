import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()
  return {
    wrapper: 'relative ml-4 my-3',
    content: 'row-center flex-wrap gap-x-2 gap-y-1 pointer-events-none',
    count: cn('text-sm pretty-num whitespace-nowrap', fg('title')),
    separator: cn('text-xs', fg('digest')),
    lastReply: cn('row-center gap-1 text-sm whitespace-nowrap', fg('digest')),
    control:
      'abs-full rounded-sm cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4',
  }
}
