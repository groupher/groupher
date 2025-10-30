import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fill, bg, br, shadow, hover } = useTwBelt()

  return {
    wrapper: cn('relative'),
    inner: 'relative',
    label: 'block pointer z-50 trans-all-100',
    inputFile: 'w-px h-px opacity-0 absolute z-10 overflow-hidden',
    //
    uploadIcon: cn('size-5 absolute top-1/2 left-1/2 opacity-50 trans-all-200', fill('button.fg')),
    turboIcon: cn('size-8 absolute top-1/2 left-1/2 animate-spin z-20', fill('button.fg')),
    //
    closeBtn: cn(
      'size-4 align-both absolute -right-1 -top-1 z-10 border',
      br('divider'),
      shadow('md'),
      hover('bg'),
      bg('card'),
    ),
    crossIcon: cn('size-3.5', hover('icon-red')),
  }
}
