import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, primary } = useTwBelt()

  return {
    percent: cn('absolute inset-0 align-both text-xs bold-sm pretty-num', fg('title')),
    progress: cn('fill-none stroke-current transition-all duration-300', primary('fg')),
    ring: 'relative size-15 shrink-0',
    svg: '-rotate-90 size-15',
    track: cn('fill-none stroke-current opacity-20', fg('hint')),
    wrapper:
      'button-reset align-both -mt-2 rounded-full transition-transform hover:scale-105 focus-visible:scale-105 active:scale-95',
  }
}
