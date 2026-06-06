import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, bg, primary } = useTwBelt()

  return {
    control: cn(
      'relative w-24 aspect-[71/40] overflow-hidden rounded-md border p-0 select-none outline-none trans-all-100 box-border',
      br('divider'),
      bg('card'),
      `focus-visible:${primary('border')}`,
    ),
    controlActive: cn('border-4', primary('borderSoft')),
    verticalLine: cn(
      'absolute top-0 h-full w-0 -translate-x-1/2 border-l pointer-events-none',
      br('divider'),
    ),
    horizontalLine: cn(
      'absolute left-0 h-0 w-full -translate-y-1/2 border-t pointer-events-none',
      br('divider'),
    ),
    center: cn(
      'pointer absolute left-1/2 top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 circle trans-all-100',
      bg('digest'),
    ),
    centerActive: primary('bg'),
  }
}
