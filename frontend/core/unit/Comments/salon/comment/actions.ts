import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: 'row-center w-full',
    replyAction: cn('bold-sm pointer', fg('digest')),
    moreIcon: cn('size-4', fill('digest')),
  }
}
