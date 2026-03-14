import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'column items-center w-full gap-y-5 px-12',
    title: cn('text-xs', fg('title')),
  }
}
