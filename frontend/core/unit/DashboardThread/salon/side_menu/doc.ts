import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, bg, primary, vividDark } = useTwBelt()

  return {
    wrapper: cn('column w-full', fg('digest')),
    menu: 'column gap-1 ml-1.5 mt-2 border-l border-transparent sexy-border-50',
    item: cn(
      'block relative no-underline w-full text-sm px-1 py-1 pl-5 rounded-lg',
      `hover:${bg('hoverBg')}`,
      fg('digest'),
    ),
    itemActive: cn('py-1.5 bold-sm', primary('fg'), bg('hoverBg'), vividDark()),
    itemActiveBar: cn('absolute -left-0.5 top-2 w-1 h-4 rounded opacity-80', primary('bg')),
  }
}
