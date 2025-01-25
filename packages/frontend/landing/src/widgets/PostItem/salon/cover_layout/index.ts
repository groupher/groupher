import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export default () => {
  const { cn, fg } = useTwBelt()
  const { hoverEffect } = useBase()

  return {
    wrapper: cn(hoverEffect, 'mb-2.5 py-2'),
    main: 'column grow',
    digest: cn('text-sm mt-1.5 mb-3', fg('text.digest')),
    coverWrapper: 'min-w-44 w-44 h-24 mr-5 mt-3',
    cover: 'w-44 h-24 object-cover rounded-lg',
  }
}
