import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { bg, br, cn, fg, fill, menu, primary } = useTwBelt()

  return {
    wrapper: 'relative row-center shrink-0 rounded-lg',
    mainButton: cn(
      'button-reset min-h-10 rounded-l-lg px-4 text-sm bold-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55',
      primary('bg'),
      fg('button.fg'),
    ),
    menuButton: cn(
      'button-reset align-both size-10 rounded-r-lg border-l transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-55',
      primary('bg'),
      br('divider'),
      fg('button.fg'),
    ),
    chevron: (open: boolean) =>
      cn('size-4 transition-transform duration-200', open && 'rotate-180'),
    menu: 'w-72 p-1.5',
    menuItem: (active: boolean) =>
      cn(
        menu('bar'),
        'min-h-9 w-full px-2.5 text-left text-sm disabled:pointer-events-none disabled:opacity-45',
        active && menu('activeBox'),
      ),
    itemLabel: cn('min-w-0 flex-1 truncate', menu('title')),
    check: (active: boolean) =>
      cn('size-3 shrink-0 transition-opacity', fill('title'), active ? 'opacity-100' : 'opacity-0'),
    divider: cn('mx-2 my-1 h-px', bg('divider')),
    sectionLabel: cn('px-2.5 pb-1 pt-1.5 text-xs bold-sm', fg('hint')),
    sectionList: 'max-h-52 overflow-y-auto',
    sectionItem: (active: boolean) =>
      cn(menu('bar'), 'min-h-9 w-full pr-2.5 text-left text-sm', active && menu('activeBox')),
    emptySection: cn('px-2.5 py-2 text-sm', fg('hint')),
  }
}
