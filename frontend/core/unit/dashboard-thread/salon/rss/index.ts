import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'pl-40 w-10/12',
    innerWrapper: 'column mt-12',
    setting: 'row-center mb-12',
    title: cn('w-28', fg('title')),
  }
}
