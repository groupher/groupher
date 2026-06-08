import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, fill, primary } = useTwBelt()

  return {
    colorTrigger: cn(
      'block h-[3.375rem] w-3 shrink-0 overflow-hidden rounded-md p-0 leading-none outline-none trans-all-100 pointer',
      'hover:scale-x-110 hover:saturate-150 focus-visible:scale-x-110 focus-visible:saturate-150',
      'focus-visible:ring-2 focus-visible:ring-current',
    ),
    colorTriggerDisabled: 'opacity-50',
    colorPanel: cn('column w-42 gap-4 p-0.5'),
    colorOptionRow: 'grid grid-cols-2 gap-x-3',
    colorOption: cn(
      'row-center h-7 gap-2 text-left opacity-80 outline-none trans-all-100 pointer',
      'hover:opacity-100 focus-within:opacity-100',
    ),
    colorRadio: cn(
      'relative block size-3.5 shrink-0 rounded-full border-2 border-current opacity-80 trans-all-100',
      'after:absolute after:left-1/2 after:top-1/2 after:size-1.5 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:bg-white after:opacity-0 after:content-[""]',
      primary('fg'),
    ),
    colorRadioActive: 'opacity-100 bg-current after:opacity-100',
    colorOptionLabel: cn('text-xs', fg('title')),
    colorSliderFields: 'column gap-2',
    colorField: 'grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-2.5',
    colorLabel: cn('text-xs', fg('digest')),
    colorSlider: 'w-full cursor-ew-resize',
    colorSliderTrack:
      'relative h-2 w-full cursor-ew-resize rounded-full overflow-visible dark:brightness-75',
    colorSliderRail: 'absolute inset-0 rounded-full overflow-hidden ring-1 ring-black/10',
    colorThumb: cn(
      'absolute top-1/2 z-10 size-4 rounded-full border-2 border-white bg-[var(--thumb-color)] shadow-md outline-none',
      'ring-1 ring-black/15 cursor-ew-resize',
    ),
    opacitySliderTrack:
      'relative h-2 w-full cursor-ew-resize rounded-full overflow-visible ring-1 ring-black/10 dark:brightness-75',
    settingButton: cn(
      'align-both size-5 rounded-none border-0 bg-transparent p-0 outline-none pointer trans-all-100',
      'hover:scale-110 focus-visible:scale-110',
    ),
    settingIcon: cn('size-4', fill('digest')),
  }
}
