import useTwBelt from '~/hooks/useTwBelt'

export default function useTuningSectionSalon() {
  const { cn, br, fg, hover, primary } = useTwBelt()

  return {
    section: cn('column gap-3 w-full'),
    tuningGrid: 'grid grid-cols-2 gap-x-10 gap-y-5 w-full',
    tuningColumn: 'column gap-3 min-w-0',
    gradientTuning: 'col-span-2 grid grid-cols-2 gap-x-10 gap-y-5 mt-8',
    colorChips: 'row-center gap-2',
    rendererGrid: 'row-center wrap gap-2',
    rendererButton: cn(
      'rounded-md border px-2.5 py-1 text-sm trans-all-200',
      br('divider'),
      fg('digest'),
      hover('bg'),
    ),
    rendererButtonActive: cn(primary('border'), primary('fg')),
    angle: 'w-20',
  }
}
