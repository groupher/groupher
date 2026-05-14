import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'column-align-both w-full h-screen text-sm',
    title: cn('text-base bold-sm mb-2.5', fg('title')),
    desc: cn('text-sm', fg('digest')),
  }
}
