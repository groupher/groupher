import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, margin } = useTwBelt()

  return {
    settingRow: 'row align-start gap-4 py-3',
    swatches: 'w-2/5 pl-1 row align-start justify-end',
    swatchRow: cn('w-full wrap justify-start gap-x-2 gap-y-2'),
    row: {
      wrapper: cn(margin({})),
      inner: 'w-full',
      settingRow: 'row-end gap-4 py-3',
      labelGroup: 'w-2/5 min-w-2/5',
      label: cn('text-base', fg('title')),
      hint: cn('mt-1 text-sm', fg('digest')),
      rangeGroup: 'w-2/5 pl-px pb-0.5',
      grow: 'grow',
    },
  }
}
