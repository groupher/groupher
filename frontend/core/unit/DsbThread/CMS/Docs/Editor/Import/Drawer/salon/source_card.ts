import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { bg, br, cn, fg, hover } = useTwBelt()

  return {
    sourceCard: (expanded: boolean) =>
      cn('overflow-hidden rounded-xl', bg('card'), expanded && 'border', expanded && br('divider')),
    sourceCardTrigger: (expanded: boolean) =>
      cn(
        'button-reset group row min-h-20 w-full items-start gap-3 rounded-xl p-4 text-left',
        'disabled:cursor-default disabled:opacity-55',
        expanded ? 'cursor-default' : hover('box'),
      ),
    sourceCardPanelMotion: 'overflow-hidden',
    sourceCardPanel: 'px-2 pb-2',
    sourceIcon: cn('align-both size-10 shrink-0 rounded-lg', bg('sandBox')),
    sourceCopy: 'column min-w-0 flex-1 gap-1',
    sourceTitleRow: 'row-center min-w-0 gap-2',
    sourceTitle: cn('truncate text-sm bold-sm', fg('title')),
    sourceBadge: cn('shrink-0 rounded-md px-1.5 py-0.5 text-xs', bg('sandBox'), fg('digest')),
    sourceDescription: cn('text-sm text-pretty leading-5', fg('digest')),
    sourceArrow: 'align-both size-5 shrink-0 group-smoky-65',
    sourceArrowIcon: cn('size-3.5', fg('digest')),
  }
}
