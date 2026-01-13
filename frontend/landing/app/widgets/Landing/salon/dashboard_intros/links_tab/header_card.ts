import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, br, shadow } = useTwBelt()

  return {
    wrapper: cn(
      'row-between px-4 pb-0 z-20 w-11/12 h-16 rounded-xl border',
      'absolute top-2 left-4',
      fg('text.digest'),
      bg('card'),
      br('divider'),
      shadow('sm'),
    ),
    communityLogo: cn('size-5 rounded mr-1.5 gradient-orange'),
    title: cn('row-center text-sm', fg('text.title')),
    links: 'align-both -ml-2 gap-x-4',
    linkName: 'text-xs',
    //
    bar: cn('w-4 h-1.5 opacity-15', bg('text.digest')),
  }
}
