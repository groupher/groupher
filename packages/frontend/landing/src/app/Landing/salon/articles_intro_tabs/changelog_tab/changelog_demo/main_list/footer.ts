import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, br, fill, fg } = useTwBelt()

  return {
    wrapper: cn('row-center-between mt-3.5 w-52'),
    upvote: cn('align-both -ml-0.5 w-10 h-5 rounded border', br('divider')),
    icon: cn('size-3', fill('text.digest')),
    count: cn('text-xs ml-1 bold-sm', fg('text.digest')),
    date: cn('text-xs', fg('text.hint')),
  }
}
