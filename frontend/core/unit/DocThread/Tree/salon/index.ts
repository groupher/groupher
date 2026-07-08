import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  compact: boolean
}

export default function useSalon({ compact }: TProps) {
  const { cn, fg, br, scrollbar } = useTwBelt()

  return {
    wrapper: cn(
      compact
        ? 'relative column max-h-80 w-full overflow-visible'
        : 'sticky top-20 column h-fit max-h-screen w-full overflow-visible',
      fg('digest'),
    ),
    inner: cn('column min-h-0', compact ? 'border-b pb-4' : 'min-h-screen border-r', br('divider')),
    groupList: cn(
      'column min-h-0 flex-1 gap-y-4 overflow-y-auto overscroll-contain pb-14 pr-2',
      scrollbar('thin'),
    ),
    empty: 'px-1 pt-1 text-xs text-digest',
  }
}
