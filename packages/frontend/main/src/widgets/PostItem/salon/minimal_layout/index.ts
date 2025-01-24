import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export default () => {
  const { cn, fg } = useTwBelt()
  const { hoverEffect } = useBase()

  return {
    wrapper: cn(hoverEffect, 'mb-2'),
    main: 'column grow',
    avatarWrapper: 'column-center justify-between pt-2.5 pb-0.5 mr-2',
    digest: cn('text-sm mt-1.5 mb-3 max-w-96 line-clamp-1', fg('text.digest')),
    upvoteWrapper: 'w-10 mr-5 mt-1.5',
  }
}
