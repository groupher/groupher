import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, bg, fg, fill, primary } = useTwBelt()

  return {
    wrapper: 'row-center gap-2.5',
    emptyItem: cn(
      'align-both size-6 rounded border outline-none trans-all-100',
      `hover:${primary('border')}`,
      `focus-visible:${primary('border')}`,
      br('divider'),
      bg('card'),
    ),
    emptyIcon: cn('size-3', fill('digest')),
    optionItemActive: cn('bold-sm', fg('title'), primary('border')),
    control: cn(
      'relative h-12 w-20 overflow-hidden rounded-md border outline-none trans-all-100 touch-none',
      `hover:${primary('border')}`,
      `focus-visible:${primary('border')}`,
      br('divider'),
      bg('card'),
    ),
    controlActive: primary('border'),
    svg: 'size-full',
    frame: cn('fill-none stroke-current opacity-40', fg('digest')),
    stick: cn('stroke-current stroke-[3px] opacity-80', primary('fg')),
    center: cn('fill-current opacity-70', fg('digest')),
    handle: cn('fill-current', primary('fg')),
  }
}
