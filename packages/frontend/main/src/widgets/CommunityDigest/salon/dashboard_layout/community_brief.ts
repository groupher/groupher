import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, br, fill, menu, sexyBorder } = useTwBelt()

  return {
    wrapper: 'row-center group',
    logo: 'size-5',
    menuWrapper: cn(
      'row-center trnas-all-200 h-8 w-auto rounded-lg border border-transparent pointer',
      `hover:${br('divider')}`,
    ),
    title: cn('row-center text-sm bold-sm ml-1.5 max-w-32 truncate', fg('text.digest')),
    slash: cn('text-xs ml-2 mr-1.5', fg('text.digest')),
    optArrowIcon: cn('size-3 mr-1.5 group-smoky-80', fg('text.digest')),
    //
    topPanel: cn('border px-3 py-1 w-40 min-h-28', br('divider')),
    arrowIcon: cn('size-3.5', fill('text.digest')),

    panelItem: cn(menu('bar'), 'h-8 mt-1'),

    outside: 'hover-underline',
    icon: cn('size-3.5 mr-3 pointer', fill('text.digest'), `group-hover:${fill('text.title')}`),
    //
    divider: cn(sexyBorder(), 'my-1.5'),
  }
}
