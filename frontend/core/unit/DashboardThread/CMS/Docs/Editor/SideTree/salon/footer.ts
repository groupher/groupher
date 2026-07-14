import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { fg, bg, cn, hover, sexyBorder } = useTwBelt()
  const text = cn('ml-1 text-xs', fg('digest'))

  return {
    wrapper: 'z-10 column min-h-12 w-full shrink-0 bg-base/95 text-sm text-digest backdrop-blur-sm',
    divider: sexyBorder(35),
    content: 'row-center min-h-12 w-full px-1.5 py-1',
    grow: 'grow',
    iconButton: 'align-both h-6 min-w-10 shrink-0',
    iconButtonSurface: cn('row-center h-full whitespace-nowrap rounded-sm px-1.5', hover('bg')),
    iconOnlyButton: cn('grid size-10 place-items-center rounded-sm', hover('bg')),
    icon: 'size-4 opacity-80',
    trashIcon: cn('size-3.5', hover('icon')),
    trashText: cn(text, '@max-doc-tree-min:hidden'),
    assetsText: cn(text, '@max-doc-tree-footer:hidden'),
    count: cn(
      'grid h-5 min-w-4 place-items-center rounded-md px-1.5 text-xs leading-none text-digest tabular-nums',
      bg('badge'),
    ),
  }
}
