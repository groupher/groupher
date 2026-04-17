import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { bg, br, cn, fg, shadow } = useTwBelt()

  return {
    wrapper: 'w-56 column-center',
    pickerPanel: 'column gap-y-3 w-full',
    colorArea: cn(
      'relative w-full h-32 rounded-md overflow-hidden border',
      br('divider'),
      shadow('sm'),
    ),
    slider: 'w-full',
    sliderTrack: cn(
      'relative w-full h-4 rounded-md overflow-hidden border',
      br('divider'),
      shadow('sm'),
    ),
    colorAreaThumb: cn(
      'size-4 rounded-full border-2 border-white bg-transparent shadow-md outline-none',
      "after:absolute after:left-1/2 after:top-1/2 after:size-4 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:border after:border-black/80 after:bg-[var(--thumb-color)] after:content-['']",
    ),
    colorSliderThumb: cn(
      'absolute size-4 rounded-full border-2 border-white bg-transparent shadow-md outline-none',
      "after:absolute after:left-1/2 after:top-1/2 after:size-4 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full after:border after:border-black/80 after:bg-[var(--thumb-color)] after:content-['']",
    ),
    inputFooter: 'row-center',
    inputLabel: cn('text-sm mr-2', fg('digest')),
    colorField: cn('w-full rounded-md border px-0', bg('popover.bg'), br('divider'), shadow('sm')),
    colorInput: cn(
      'w-full h-6 pl-2 rounded-md text-xs outline-none focus-visible:ring-1 focus-visible:ring-inset',
      fg('title'),
      'focus-visible:ring-current',
    ),
  }
}
