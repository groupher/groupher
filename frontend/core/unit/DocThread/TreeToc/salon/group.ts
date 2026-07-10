import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: 'column border-b border-transparent',
    title: cn('min-w-0 truncate text-sm ml-px smoky-65', fg('digest')),
    children: 'column gap-y-1.5 mt-2 min-h-3 border-b border-transparent',
  }
}
