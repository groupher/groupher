import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'flex items-center w-full min-h-5 gap-3',
    label: cn('w-20 shrink-0 text-sm leading-none', fg('digest')),
    content: 'flex-1 min-w-0 row-center',
  }
}
