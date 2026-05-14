import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'row mb-12 mt-px',
    hint: cn('text-sm mt-0.5 w-20 opacity-80', fg('digest')),
    cardsWrapper: 'row-center w-full wrap ml-4 gap-3.5',
  }
}
