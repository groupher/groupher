import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br, fg } = useTwBelt()

  return {
    wrapper: 'w-full',
    controls: 'column gap-5 pt-1',
    panel: 'flex items-center gap-3',
    label: cn('w-20 shrink-0 text-sm bold-sm', fg('digest')),
    chips: 'row-center wrap gap-2',
    chip: cn('size-6 circle border-2 pointer trans-all-200', br('divider')),
    colorInput: 'sr-only',
    rangeGroup: 'column gap-4 min-w-0',
    textureControl: 'column gap-4 w-full min-w-0',
    textureIntensity: 'w-full min-w-0',
  }
}
