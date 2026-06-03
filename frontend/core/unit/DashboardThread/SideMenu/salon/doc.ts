import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, bg, hover, primary, vividDark } = useTwBelt()

  return {
    wrapper: cn('column w-full', fg('digest')),
    header: 'row-center justify-between mb-4',
    collapseToggle: cn(
      'align-both size-6 rounded-md border border-transparent trans-all-100 pointer -mt-0.5',
      'smoky-65',
      hover('bg'),
    ),
    collapseIcon: cn('size-3.5'),
    menu: 'column gap-1 ml-1.5 mt-2 border-l border-transparent sexy-border-50',
    item: cn(
      'block relative no-underline w-full text-sm px-1 py-1 pl-5 rounded-lg overflow-hidden',
      `hover:${bg('hoverBg')}`,
      fg('digest'),
    ),
    itemActive: cn('py-1.5 bold-sm', primary('fg'), vividDark()),
    itemActiveBg: cn('absolute inset-0 rounded-lg rounded-tl-none rounded-bl-none', bg('hoverBg')),
    itemActiveBar: cn('absolute -left-0.5 top-2 w-1 h-4 rounded opacity-80', primary('bg')),
    itemLabel: 'relative z-10',
  }
}
