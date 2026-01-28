import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: 'column p-1.5 w-24',
    item: 'group row-between',
    title: cn('text-xs', fg('title')),
    transforIcon: cn('text-xs size-3', fill('digest')),
  }
}
