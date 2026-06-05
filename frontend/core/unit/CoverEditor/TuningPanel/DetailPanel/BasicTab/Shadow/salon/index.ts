import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, fg, bg, fill, shadow } = useTwBelt()

  return {
    wrapper: 'column w-full',
    optionRow: 'row-center gap-2.5',
    emptyItem: cn(
      'align-both size-7 rounded border trans-all-100',
      `hover:${br('digest')}`,
      br('divider'),
      bg('card'),
      shadow('sm'),
    ),
    emptyIcon: cn('size-3.5', fill('digest')),
    shadowBox: cn(
      'size-7 rounded-md border trans-all-100',
      `hover:${br('digest')}`,
      br('divider'),
      bg('card'),
    ),
    optionItemActive: cn('bold-sm', fg('title'), br('digest')),
  }
}
