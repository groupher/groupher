import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, bg } = useTwBelt()

  return {
    wrapper: 'row-center -ml-2.5',
    input: cn('w-36 h-7', bg('alphaBg')),
  }
}
