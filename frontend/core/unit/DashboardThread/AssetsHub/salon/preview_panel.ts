import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg, br } = useTwBelt()

  return {
    wrapper: 'column w-full gap-3 mt-4',
    previewPanel: cn('row gap-4 p-3 border rounded', br('divider'), bg('card')),
    previewFrame: cn(
      'align-both size-40 shrink-0 overflow-hidden rounded-sm border',
      br('divider'),
      bg('hoverBg'),
    ),
    previewImage: 'size-full object-contain',
    previewFallback: cn('align-both column gap-2 text-xs', fg('digest')),
    previewInfo: 'column flex-1 min-w-0 justify-center',
    previewTitle: cn('text-sm bold-sm truncate', fg('title')),
    previewMeta: cn('row gap-3 mt-2 text-xs flex-wrap', fg('hint')),
    previewRef: cn('mt-3 text-xs truncate', fg('digest')),
    actions: 'row gap-1 mt-4',
    iconAction: cn(
      'align-both size-8 rounded-sm transition-colors disabled:opacity-35 disabled:cursor-not-allowed',
      fg('digest'),
      `hover:${fg('title')}`,
      `hover:${bg('hoverBg')}`,
    ),
  }
}
