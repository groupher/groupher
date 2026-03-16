import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'ml-2.5',
    countHint: cn('row-center text-xs ml-4 mt-2.5', fg('digest')),
    countNum: cn('bold-sm mr-1', fg('digest')),
    slashSign: 'text-xs bold mr-2',
  }
}
