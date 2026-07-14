import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: 'row-between px-0.5 mt-2',
    title: cn('row-center text-base bold-sm mt-1.5', fg('title')),
    count: cn('pretty-num mt-0.5 ml-2.5 text-xs', fg('hint')),
    kanbanIcon: cn('size-4 mr-2 mt-1.5 rotate-180', fill('digest')),
    //
    left: 'row-center',
    right: 'row-center',
    //
    joinTitle: cn('text-xs mr-3', fg('digest')),
  }
}
