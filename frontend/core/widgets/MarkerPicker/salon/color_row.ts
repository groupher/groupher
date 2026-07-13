import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, fill, primary, shadow } = useTwBelt()

  return {
    wrapper: 'column gap-y-1.5',
    title: cn('text-xs bold-sm', fg('digest')),
    colors: 'grid grid-cols-6 justify-items-center gap-y-1',
    swatchButton:
      'align-both size-10 rounded-full outline-none transition-transform duration-150 hover:-translate-y-0.5 active:scale-[0.96] focus-visible:ring-1 focus-visible:ring-current',
    swatch: 'align-both size-6 rounded-full border border-black/5 dark:border-white/10',
    swatchActive: cn('size-7 ring-1 ring-current', primary('fg'), shadow('sm')),
    checkIcon: cn('size-3', fill('button.fg')),
    customSlot: 'col-start-6 align-both',
    customMotion: 'overflow-hidden',
    customPicker: 'column-center pb-1 pt-2',
  }
}
