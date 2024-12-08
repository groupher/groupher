import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, bg, fill, sexyHBorder } = useTwBelt()

  return {
    wrapper: cn(
      'column-align-both z-30 w-full rounded-md px-8 fixed left-0 bottom-14 h-16',
      bg('card'),
    ),
    divider: sexyHBorder(35),
    inner: 'row-center-between w-full h-full pt-2',
    blankIcon: cn('size-3.5 mr-2.5', fill('text.digest')),
  }
}
