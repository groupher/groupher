import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, primary } = useTwBelt()

  return {
    body: 'row-center gap-5 p-4 pr-8',
    detail: cn('mt-1 whitespace-nowrap text-sm leading-5 pretty-num', fg('hint')),
    meta: 'column min-w-0',
    percent: cn('mt-2 text-xs leading-4 pretty-num', fg('hint')),
    progress: cn('fill-none stroke-current transition-all duration-300', primary('fg')),
    ring: 'relative size-18 shrink-0',
    ringPercent: cn('absolute inset-0 align-both text-xs bold-sm pretty-num', fg('title')),
    svg: '-rotate-90 size-18',
    title: cn('text-base bold-sm leading-6', fg('title')),
    track: cn('fill-none stroke-current opacity-20', fg('hint')),
  }
}
