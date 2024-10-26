import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, br, global, shadow } = useTwBelt()

  return {
    wrapper: cn(
      'row justify-between w-11/12 h-40 px-3.5 pb-0 pt-5 z-20 rounded-xl border',
      'absolute bottom-2 left-4',
      shadow('sm'),
      bg('htmlBg'),
      br('divider'),
    ),
    brand: 'w-1/3',
    communityLogo: cn('size-6 rounded mr-1.5 mt-0.5 mb-2', global('gradient-orange')),
    title: cn('row-center text-sm', fg('text.title')),
    desc: cn('row-center text-xs mt-1', fg('text.digest')),
    //
    links: 'column gap-x-2.5',
    linkTitle: cn('text-xs mb-2.5', fg('text.title')),
    linkName: cn('text-xs mb-2 opacity-80', fg('text.digest')),
    //
    social: 'row-center gap-x-1.5 mt-4',
    icon: 'size-3.5 opacity-65',
  }
}
