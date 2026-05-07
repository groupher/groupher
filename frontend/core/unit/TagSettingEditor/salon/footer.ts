import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, br, bg } = useTwBelt()

  return {
    wrapper: cn('row-center w-full border-t px-6 py-4', br('divider'), bg('card')),
    updateWrapper: 'row-center gap-3',
  }
}
