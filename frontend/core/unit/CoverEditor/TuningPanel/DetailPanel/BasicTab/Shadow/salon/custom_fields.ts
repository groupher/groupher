import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    customFields: 'column gap-2',
    fieldRow: 'grid grid-cols-[3.75rem_minmax(0,1fr)] items-center gap-2',
    fieldLabel: cn('text-xs leading-none', fg('digest')),
    offsetFields: 'grid grid-cols-2 gap-2',
    offsetField: 'grid grid-cols-[0.75rem_minmax(0,1fr)] items-center gap-1.5',
    axisLabel: cn('text-xs leading-none', fg('digest')),
  }
}
