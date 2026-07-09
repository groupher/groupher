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
        : 'column h-full min-h-0 w-full overflow-visible',
      fg('digest'),
    ),
    inner: cn('column min-h-0', compact ? cn('border-b pb-4', br('divider')) : 'h-full'),
    groupList: cn('column min-h-0 flex-1 gap-y-4 overflow-y-auto pb-14 pr-2', scrollbar('thin')),
    empty: 'px-1 pt-1 text-xs text-digest',
  }
}
