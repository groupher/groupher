import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('row-center pt-4 ml-7', fg('digest')),
    slashSign: 'text-xs bold opacity-65 mr-2',
    dateText: 'text-xs',
  }
}
