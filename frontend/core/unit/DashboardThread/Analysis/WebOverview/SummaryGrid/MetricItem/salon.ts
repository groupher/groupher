import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'w-full py-4 text-left',
    label: 'text-digest text-xs',
    value: 'text-title mt-2 text-2xl tabular-nums',
    change: 'mt-1 flex items-baseline gap-1.5 tabular-nums',
    positiveChange: 'text-sm text-green-600',
    negativeChange: 'text-sm text-red-600',
    comparison: cn('text-xs', fg('hint')),
  }
}
