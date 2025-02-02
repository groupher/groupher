import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fill } = useTwBelt()

  return {
    wrapper: 'row-center-between w-20',
    title: cn('text-xs pl-0.5 bold-sm'),
    editIcon: cn('size-3 mr-1.5', fill('button.fg')),
  }
}
