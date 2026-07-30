import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon({ selected }: { selected: boolean }) {
  const { cn, fg, br, primary } = useTwBelt()

  return {
    actions:
      'absolute right-1 top-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
    content: 'column gap-1 p-2',
    deleteAction:
      'ml-2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100',
    meta: cn('text-xs leading-4', fg('hint')),
    title: cn('truncate text-left text-sm bold-sm underline-hover', fg('title')),
    wrapper: cn(
      'group relative mb-3 break-inside-avoid overflow-hidden rounded-sm border transition-colors',
      selected ? primary('borderLite') : br('divider'),
    ),
  }
}
