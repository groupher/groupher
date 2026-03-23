import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn('row-center pt-6 pb-4 ml-6', fg('digest')),
    slashSign: 'text-xs bold opacity-65 mr-2',
    text: cn('text-xs ml-3.5 pointer', fg('digest')),
  }
}
