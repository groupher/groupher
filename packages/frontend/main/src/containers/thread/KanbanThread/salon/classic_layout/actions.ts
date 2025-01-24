import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: cn('row-center-between px-0.5 mt-2'),
    title: cn('row-center text-base bold-sm mt-1.5', fg('text.title')),
    count: cn('text-xs ml-2.5 mt-0.5', fg('text.hint')),
    kanbanIcon: cn('size-4 mr-2 mt-1.5 rotate-180', fill('text.digest')),
    //
    left: 'row-center',
    right: 'row-center',
    //
    joinTitle: cn('text-xs mr-3', fg('text.digest')),
  }
}
