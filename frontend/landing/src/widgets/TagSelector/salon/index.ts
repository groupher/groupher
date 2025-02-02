import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, bg, br, menu } = useTwBelt()

  return {
    wrapper: cn(
      'row-center h-8 text-sm px-0.5 pl-2.5 rounded-md border',
      br('divider'),
      fg('text.digest'),
      bg('hoverBg'),
      `hover:${br('text.digest')}`,
    ),
    label: cn('text-xs mr-1', fg('text.hint')),
    selectItem: cn(menu('bar'), 'w-auto px-2 py-0.5 rounded mb-1.5 relative'),
  }
}
