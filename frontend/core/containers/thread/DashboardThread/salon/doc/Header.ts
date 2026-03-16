import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'row-center w-full pb-2.5 mb-2.5',
    title: cn('text-sm', fg('title')),
  }
}
