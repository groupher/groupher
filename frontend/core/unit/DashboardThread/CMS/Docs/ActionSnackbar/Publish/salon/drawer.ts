import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill, br, hover, primary } = useTwBelt()

  return {
    drawer: 'column h-full',
    header: cn('row-center h-16 shrink-0 border-b px-5', br('divider')),
    titleGroup: 'row-center min-w-0 flex-1 gap-2',
    titleIcon: cn('size-4.5 shrink-0', fill('title')),
    title: cn('truncate text-base bold-sm', fg('title')),
    closeButton: cn('align-both size-8 rounded-lg button-reset', hover('box')),
    closeIcon: cn('size-3.5', fill('digest'), hover('icon')),
    body: 'min-h-0 flex-1 overflow-y-auto px-5 py-4',
    menu: cn('column w-full gap-3', fg('digest')),
    footer: cn('row-center justify-end shrink-0 border-t px-5 py-4', br('divider')),
    publishButton: cn(
      'h-8 px-4 rounded-lg button-reset text-sm bold-sm whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed',
      primary('bg'),
      fg('button.fg'),
    ),
  }
}
