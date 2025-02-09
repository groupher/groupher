import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export default () => {
  const { cn, fg } = useTwBelt()
  const { hoverTitle } = useBase()

  return {
    wrapper: 'row mt-0.5',
    title: cn(hoverTitle, 'bold-sm'),
    brief: cn('row-center grow ml-2.5 mb-1.5', fg('text.digest')),
  }
}
