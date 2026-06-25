import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { sexyBorder } = useTwBelt()

  return {
    wrapper:
      'sticky bottom-0 z-10 column min-h-12 w-full shrink-0 bg-base/95 text-sm text-digest backdrop-blur-sm',
    divider: sexyBorder(35),
    content: 'row-center min-h-12 w-full px-1.5 py-2',
    grow: 'grow',
    iconButton: 'row-center h-8 min-w-8 gap-x-1 rounded-sm px-1.5 hover:bg-hover transition-colors',
    iconOnlyButton: 'grid place-items-center size-8 rounded-sm hover:bg-hover transition-colors',
    icon: 'size-4 opacity-80',
    count: 'text-xs leading-none text-digest',
    publishLabel: 'row-center gap-x-1 pl-2.5 text-xs text-title',
    eventCount:
      'grid h-3.5 min-w-3.5 place-items-center rounded-full bg-hover px-1 text-[9px] leading-none text-digest tabular-nums',
  }
}
