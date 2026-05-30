import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br } = useTwBelt()

  return {
    wrapper: 'column w-full min-w-0',
    items: 'column gap-4 w-full min-w-0',
    chips: 'row-center wrap gap-2',
    chip: cn('size-6 circle border-2 pointer trans-all-200', br('divider')),
    angle: 'flex justify-start',
  }
}
