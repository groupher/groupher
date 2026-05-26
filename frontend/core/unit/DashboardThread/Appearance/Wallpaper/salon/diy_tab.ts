import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, bg, fg, primary, fill } = useTwBelt()

  return {
    wrapper: 'column gap-5 mt-2.5',
    presets: 'row-center wrap gap-3',
    presetCard: cn(
      'size-14 rounded-lg overflow-hidden relative border border-2 border-transparent pointer trans-all-200',
      br('divider'),
      `hover:${br('digest')}`,
    ),
    presetActive: br('digest'),
    presetPreview: 's-full',
    activeSign: cn(
      'size-5 circle absolute -top-1 -right-0.5 z-20 border',
      primary('bg'),
      br('title'),
    ),
    checkIcon: cn('size-3.5 absolute top-0.5 left-0.5', fill('button.fg')),
    controls: 'grid grid-cols-2 gap-7 pt-1',
    panel: 'column gap-4',
    label: cn('text-sm bold-sm', fg('digest')),
    chips: 'row-center wrap gap-2',
    chip: cn('size-8 circle border-2 pointer trans-all-200', br('divider')),
    colorInput: 'sr-only',
    actionRow: 'row-center gap-2',
    action: cn(
      'row-center rounded-md px-3 h-8 text-xs bold-sm pointer trans-all-200',
      bg('hoverBg'),
      fg('title'),
      `hover:${bg('card')}`,
    ),
    hint: cn('text-xs leading-5', fg('digest')),
    rangeGroup: 'column gap-4',
  }
}
