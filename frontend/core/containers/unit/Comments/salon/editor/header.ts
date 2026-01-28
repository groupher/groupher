import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, fill, avatar } = useTwBelt()

  return {
    wrapper: cn('row-center h-10 pointer'),
    expandWrapper: 'row-center h-14 ml-0 relative',
    hintText: cn('absolute -top-6 left-0.5 text-xs opacity-50', fg('digest')),
    unLogUserIcon: cn('size-3 opacity-50', fill('digest')),
    avatar: cn('size-5 ml-2', avatar()),
    leaveRes: cn('text-sm ml-4 opacity-50', fg('digest')),
    leaveResUsername: cn('text-base mx-3.5', fg('digest')),
    //
    commentIcon: cn('size-3.5 mr-4', fill('digest')),
  }
}
