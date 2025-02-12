import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, bg, br, fill, fg } = useTwBelt()

  return {
    wrapper: cn(
      'column-align-both relative border border-dashed rounded-md w-11/12 h-40 trans-all-100',
      br('divider'),
      bg('sandBox'),
      `hover:${br('text.digest')}`,
    ),
    uploadIcon: cn('size-7', fill('text.digest')),
    title: cn('text-sm mt-4 bold-sm', fg('text.digest')),
    //
    menu: cn(
      'size-7 align-both absolute right-2.5 top-2.5 rounded border z-20',
      bg('card'),
      br('divider'),
    ),
    moreIcon: cn('size-4', fill('text.digest')),
  }
}
