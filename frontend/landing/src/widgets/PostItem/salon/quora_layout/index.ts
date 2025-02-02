import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export default () => {
  const { cn, fg } = useTwBelt()
  const { hoverEffect } = useBase()

  return {
    wrapper: cn(hoverEffect, 'column grow'),
    digest: cn('text-sm mt-1.5 mb-3 w-11/12 truncate', fg('text.digest')),
  }
}
