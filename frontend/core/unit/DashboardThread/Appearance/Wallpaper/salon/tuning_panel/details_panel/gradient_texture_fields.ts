import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br, fg } = useTwBelt()

  return {
    wrapper: 'column gap-4 w-full min-w-0',
    controls: 'column gap-4 w-full min-w-0',
    panel: 'flex items-center gap-3',
    label: cn('w-20 shrink-0 text-sm bold-sm', fg('digest')),
    chips: 'row-center wrap gap-2',
    chip: cn('size-6 circle border-2 pointer trans-all-200', br('divider')),
    intensity: 'w-full min-w-0',
  }
}
