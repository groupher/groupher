import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill, br, hover } = useTwBelt()

  return {
    wrapper: 'column h-full',
    header: cn('row-center h-16 shrink-0 border-b px-5', br('divider')),
    titleGroup: 'row-center min-w-0 flex-1 gap-2',
    titleIcon: cn('size-4.5 shrink-0', fill('title')),
    title: cn('truncate text-base bold-sm', fg('title')),
    closeButton: cn('align-both size-8 rounded-lg button-reset', hover('box')),
    closeIcon: cn('size-3.5', fill('digest'), hover('icon')),
    body: 'min-h-0 flex-1 overflow-y-auto px-5 py-4',
  }
}
