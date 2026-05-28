import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, fg, primary, fill } = useTwBelt()

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
    controls: 'column gap-5 pt-1',
    panel: 'flex items-center gap-3',
    label: cn('w-20 shrink-0 text-sm bold-sm', fg('digest')),
    chips: 'row-center wrap gap-2',
    chip: cn('size-6 circle border-2 pointer trans-all-200', br('divider')),
    colorInput: 'sr-only',
    settingsWrapper: 'w-full',
    rangeGroup: 'column gap-4 min-w-0',
    textureControl: 'column gap-4 w-full min-w-0',
    textureIntensity: 'w-full min-w-0',
  }
}
