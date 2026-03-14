import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn(fg('digest')),
    publish: 'row-center text-sm ml-0.5 mb-2',
    bottom: 'row-between',
  }
}
