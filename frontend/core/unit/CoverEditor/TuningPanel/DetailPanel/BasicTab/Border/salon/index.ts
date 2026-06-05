import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, fg, bg, fill, primary } = useTwBelt()

  return {
    wrapper: 'column w-full',
    items: 'column gap-3 w-full',
    optionRow: 'row-center gap-2.5',
    emptyIcon: cn('size-3', fill('digest')),
    radiusEmptyItem: cn(
      'align-both h-9 w-14 rounded-md border outline-none trans-all-100',
      `hover:${primary('border')}`,
      `focus-visible:${primary('border')}`,
      br('divider'),
      bg('card'),
    ),
    optionItemActive: cn('bold-sm', fg('title'), primary('border')),
    radiusBox: cn(
      'h-9 w-14 border outline-none trans-all-100',
      `hover:${primary('border')}`,
      `focus-visible:${primary('border')}`,
      br('divider'),
      bg('card'),
    ),
    radiusBoxActive: primary('border'),
  }
}
