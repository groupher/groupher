import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, menu, fill, shadow } = useTwBelt()

  return {
    wrapper: cn(
      'absolute -right-1.5 top-10 w-28 h-28 px-1 pt-1 z-20 trans-all-200 rounded-md',
      menu('bg'),
      shadow('xl'),
    ),
    hover: '-right-4 top-7',
    //
    item: cn(menu('bar'), 'py-1 text-xs'),
    iconBox: 'align-both size-3.5 mr-2',
    icon: cn('size-3', fill('text.digest')),
  }
}
