import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, bg } = useTwBelt()

  return {
    wrapper: cn('grid grid-cols-2 gap-x-5 gap-y-7 px-6 py-5', bg('sandBox')),
    layout: 'column-center justify-between h-28 w-full min-w-0',
  }
}
