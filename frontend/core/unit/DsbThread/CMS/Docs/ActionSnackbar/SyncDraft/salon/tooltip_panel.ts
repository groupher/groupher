import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'column gap-1 px-2 py-1',
    title: cn('text-sm bold-sm', fg('title')),
    digest: cn('text-xs leading-5', fg('digest')),
  }
}
