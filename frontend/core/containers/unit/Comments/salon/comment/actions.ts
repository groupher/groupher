import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, fill } = useTwBelt()

  return {
    wrapper: cn('row-center w-full'),
    replyAction: cn('bold-sm pointer', fg('text.digest')),
    moreIcon: cn('size-4', fill('text.digest')),
  }
}
