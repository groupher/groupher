import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, bg, fill, sexyBorder } = useTwBelt()

  return {
    wrapper: cn(
      'column-align-both z-30 w-full rounded-md px-12 fixed left-0 bottom-10 h-16',
      bg('card'),
    ),
    divider: sexyBorder(),
    inner: 'row-between w-full h-full pt-2',
    blankIcon: cn('size-3.5 mr-2.5', fill('digest')),
  }
}
