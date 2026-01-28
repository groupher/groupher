import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: 'row-between px-0.5 w-full',
    title: cn('row-center text-base bold-sm mt-1.5', fg('title')),
    count: cn('text-xs ml-2.5', fg('digest')),
    kanbanIcon: cn('size-4 mr-2 mt-1.5 rotate-180', fill('digest')),
    joinTitle: cn('text-xs mr-3', fg('digest')),
  }
}
