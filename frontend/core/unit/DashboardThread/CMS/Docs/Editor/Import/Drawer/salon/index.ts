import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { bg, br, cn, fg, fill, hover } = useTwBelt()

  return {
    drawer: 'column h-full',
    header: cn('row-center h-16 shrink-0 border-b px-5', br('divider')),
    titleGroup: 'row-center min-w-0 flex-1 gap-2',
    titleIcon: cn('size-4.5 shrink-0', fill('title')),
    title: cn('truncate text-base bold-sm', fg('title')),
    backButton: cn(
      'button-reset group row-center mr-auto min-h-10 rounded-lg px-2 pr-3 text-sm bold-sm',
      fg('title'),
      hover('box'),
    ),
    backIcon: cn('size-4 shrink-0', fill('digest'), hover('icon')),
    closeButton: cn('align-both size-10 rounded-lg button-reset', hover('box')),
    closeIcon: cn('size-3.5', fill('digest'), hover('icon')),
    body: 'min-h-0 flex-1 overflow-y-auto px-5 py-5',
    sourceFlow: 'column gap-5',
    previewFlow: 'column gap-5',
    heading: cn('text-base bold-sm text-balance', fg('title')),
    description: cn('mt-1 text-sm text-pretty leading-5', fg('digest')),
    sourceList: 'column gap-3',
    cardIcon: cn('size-5', fill('digest')),
    previewHeader: 'column gap-3',
    sourceMeta: cn('row-center justify-between gap-3 rounded-lg px-3 py-2', bg('card')),
    sourceFilename: cn('min-w-0 flex-1 truncate text-sm', fg('title')),
    sourceSize: cn('shrink-0 text-xs pretty-num', fg('digest')),
    error: cn('mt-4 rounded-lg px-3 py-2 text-sm', bg('sandBox'), fg('rainbow.red')),
    footer: cn('row-center shrink-0 justify-end gap-2 border-t px-5 py-4', br('divider')),
  }
}
