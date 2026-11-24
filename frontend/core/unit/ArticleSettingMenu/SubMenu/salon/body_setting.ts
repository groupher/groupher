import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, br, hover } = useTwBelt()

  return {
    wrapper: 'mr-1',
    editor: cn('max-h-80 min-h-48 overflow-y-auto rounded border p-1', br('divider')),
    note: cn('text-xs mt-2.5 mb-1.5', fg('hint')),
    error: cn('text-xs mt-2', fg('rainbow.red')),
    footer: cn('row-between pt-2 mt-2 border-t', br('divider')),
    back: cn('px-2 py-1 rounded text-sm', fg('digest'), hover('box')),
  }
}
