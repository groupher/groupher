import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, fill, primary } = useTwBelt()

  return {
    panel: 'column w-40 gap-3.5 p-0.5',
    fieldRow: 'grid grid-cols-[3.25rem_minmax(0,1fr)] items-center gap-2.5',
    lightFieldRow: 'grid grid-cols-[3.25rem_minmax(0,1fr)] items-start gap-2.5',
    fieldLabel: cn('text-xs', fg('digest')),
    lightFieldLabel: cn('pt-1.5 text-xs', fg('digest')),
    lightControl: cn(
      'relative size-14 overflow-hidden rounded-full border outline-none pointer touch-none',
      'bg-[#211821] border-orange-500/75',
      'focus-visible:border-orange-500',
    ),
    lightGridLineV: 'absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/10',
    lightGridLineH: 'absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/10',
    lightGuide: 'absolute h-0.5 -translate-y-1/2 rounded-full bg-orange-500/30',
    lightCenter: cn(
      'absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full',
      'bg-orange-500',
    ),
    lightCenterGlow:
      'absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/14',
    lightHandle: cn(
      'absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2',
      'border-orange-500 bg-[#211821]',
    ),
    borderFields: 'row-center gap-2',
    colorRow: 'row-center shrink-0 justify-start gap-1.5',
    colorButton: cn(
      'size-3.5 rounded-full border outline-none pointer trans-all-100',
      'hover:scale-110 focus-visible:scale-110',
      `focus-visible:${primary('border')}`,
    ),
    grayColorButton: 'border-neutral-500 bg-neutral-400',
    blackColorButton: 'border-neutral-600 bg-black',
    colorButtonActive: primary('border'),
    settingButton: cn(
      'align-both size-5 rounded-none plain-button outline-none pointer trans-all-100',
      'hover:scale-110 focus-visible:scale-110',
    ),
    settingIcon: cn('size-4', fill('digest')),
  }
}
