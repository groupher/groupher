import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br } = useTwBelt()

  return {
    wrapper: 'row justify-center w-full',
    anchor: 'w-full h-10',
    inner: 'column w-full',
    tabs: cn('row-center w-full border-b mt-2.5 mb-1 pr-4', br('divider')),
  }
}
