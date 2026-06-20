import useTwBelt from '~/hooks/useTwBelt'

export { cn, cnMerge } from '~/css'

export default function useSalon() {
  const { cn, fg, bg, br, fill, menu, sexyBorder, accent } = useTwBelt()

  return {
    wrapper: 'row-center group',
    logo: 'size-5',
    menuWrapper: cn(
      'row-center trans-all-200 h-8 w-auto rounded-lg border border-transparent pointer pl-2',
      `hover:${br('divider')}`,
      `hover:${bg('card')}`,
    ),
    title: cn('row-center text-sm bold-sm ml-1.5 max-w-32 truncate', fg('digest')),
    slash: cn('text-xs ml-1 mr-0.5', fg('digest')),
    optArrowIcon: cn('size-3 mr-1.5 group-smoky-80', fg('digest')),
    //
    topPanel: cn('border w-36 min-h-28 pl-1 py-2', br('divider')),
    arrowIcon: cn('size-3.5', fill('digest')),
    panelItem: menu('bar'),
    outside: 'hover-underline',
    // icon: cn('size-3.5 mr-3 pointer', fill('digest'), `group-hover:${fill('title')}`),
    icon: menu('icon'),
    //
    divider: cn(sexyBorder(), 'my-1.5'),
    //
    levelLabel: cn(
      'text-xs px-2 ml-1.5 py-0.5 rounded-lg bold scale-90',
      accent('bgSoft'),
      accent('fg'),
    ),
  }
}
