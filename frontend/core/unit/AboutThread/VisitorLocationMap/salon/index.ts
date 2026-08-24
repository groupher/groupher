import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg, br, primary } = useTwBelt()

  return {
    wrapper: 'w-full',
    title: cn('text-base bold mb-5', fg('digest')),
    content: 'row items-center w-full min-h-48',
    globe: 'w-1/2 row align-both min-w-0',
    globeHidden: 'hidden',
    canvas: 'w-full max-w-72 aspect-square cursor-grab active:cursor-grabbing touch-none',
    list: 'w-1/2 min-w-0 pl-4',
    listFull: 'w-full pl-0',
    row: cn('py-2 border-b last:border-b-0', br('divider')),
    rowHeader: 'row-center min-w-0',
    country: cn('text-sm truncate grow', fg('title')),
    percentage: cn('text-xs pretty-num ml-2', fg('digest')),
    visitors: cn('text-xs mt-0.5 pretty-num', fg('hint')),
    track: cn('h-1 rounded mt-1.5 overflow-hidden', bg('divider')),
    fill: cn('h-full rounded', primary('bg')),
    loading: cn('w-full h-48 rounded-xl animate-pulse', bg('hoverBg')),
  }
}
