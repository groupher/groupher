import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, bg, fill, sexyBorder } = useTwBelt()

  return {
    wrapper: cn('column-align-both mt-8 w-full rounded-md px-4 py-3', bg('card')),
    divider: sexyBorder(),
    inner: 'row-between w-full pt-2',
    blankIcon: cn('size-3.5 mr-2.5', fill('digest')),
  }
}
