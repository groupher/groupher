import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export default () => {
  const { cn, avatar } = useTwBelt()
  const { hoverEffect } = useBase()

  return {
    wrapper: hoverEffect,
    main: 'column grow',
    avatarWrapper: 'column-center justify-between pt-2.5 pb-0.5 mr-2',
    avatar: cn('size-6', avatar()),
    upvoteWrapper: 'absolute top-3.5 right-0',
  }
}
