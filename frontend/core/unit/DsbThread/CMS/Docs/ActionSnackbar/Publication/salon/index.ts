import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, br, primary } = useTwBelt()
  return {
    wrapper: 'column h-full min-h-0',
    header: cn('row-center gap-3 border-b p-4 flex-wrap', br('divider')),
    body: 'column gap-4 overflow-y-auto p-5 min-h-0 flex-1',
    button: cn(
      'px-3 py-2 rounded-md border text-sm disabled:opacity-50',
      br('divider'),
      fg('title'),
    ),
    active: cn('px-3 py-2 rounded-md text-sm', primary('bg'), fg('button.fg')),
    row: 'row-center gap-3 flex-wrap',
    columns: 'grid grid-cols-1 gap-5 md:grid-cols-2',
    panel: cn('column gap-3 p-4 border rounded-lg min-w-0', br('divider')),
    tree: 'column gap-2 pl-4',
    title: cn('text-xl bold-sm', fg('title')),
    text: cn('text-sm', fg('digest')),
    article: 'prose max-w-none break-words',
    lightImage: 'w-full rounded-lg object-cover dark:hidden',
    darkImage: 'hidden w-full rounded-lg object-cover dark:block',
    changed: cn('rounded-md border p-3', br('divider')),
  }
}
