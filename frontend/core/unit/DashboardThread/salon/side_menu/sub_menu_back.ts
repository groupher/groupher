import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill } = useTwBelt()

  return {
    back: cn('row-center no-underline text-sm mb-5', fg('digest')),
    backIcon: cn('size-4 mr-1', fill('digest')),
  }
}
