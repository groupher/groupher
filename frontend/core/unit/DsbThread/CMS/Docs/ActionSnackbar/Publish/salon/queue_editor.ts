import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, br, hover, primary } = useTwBelt()
  return {
    wrapper: 'column h-full',
    header: cn('row-center h-16 shrink-0 border-b px-5', br('divider')),
    title: cn('flex-1 text-base bold-sm', fg('title')),
    close: cn('size-8 rounded-lg button-reset', hover('box')),
    body: 'column min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-4',
    input: cn('w-full rounded-lg border px-3 py-2', br('divider'), fg('title')),
    error: cn('text-sm', fg('rainbow.red')),
    conflict: cn('column gap-3 rounded-lg border p-4', br('divider')),
    footer: cn('row-center shrink-0 justify-end border-t px-5 py-4', br('divider')),
    save: cn(
      'h-8 rounded-lg px-4 button-reset text-sm bold-sm disabled:opacity-60',
      primary('bg'),
      fg('button.fg'),
    ),
  }
}
