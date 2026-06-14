import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: cn('row-center gap-1.5 button-reset smoky-65', fg('digest')),
    icon: cn('size-4.5', fg('digest'), fill('digest')),
    count: cn('text-sm leading-none', fg('digest')),
  }
}
