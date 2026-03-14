import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fill } = useTwBelt()

  return {
    wrapper: 'row-between w-20',
    title: 'text-xs pl-0.5 bold-sm',
    editIcon: cn('size-3 mr-1.5', fill('button.fg')),
  }
}
