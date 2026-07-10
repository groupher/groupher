import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: '',
    title: cn('text-4xl bold-sm leading-tight', fg('title')),
    subtitle: cn('mt-3 text-lg leading-7', fg('digest')),
    error: cn('text-2xl bold-sm', fg('title')),
  }
}
