import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, primary } = useTwBelt()

  return {
    colorRow: 'grid grid-cols-2 gap-x-3',
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
  }
}
