import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, fg, bg, primary } = useTwBelt()

  return {
    wrapper: 'column w-full',
    optionRow: 'row-center gap-2',
    optionItem: cn(
      'align-both h-9 rounded-md border outline-none text-sm font-medium leading-none trans-all-100',
      `hover:${primary('border')}`,
      `focus-visible:${primary('border')}`,
      br('divider'),
      bg('card'),
      fg('digest'),
    ),
    optionItemActive: cn(primary('border'), fg('title')),
  }
}
