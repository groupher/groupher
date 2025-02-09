import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export default () => {
  const { cn } = useTwBelt()
  const { main } = useBase()

  return {
    wrapper: cn('column-align-both w-full mt-2.5'),
    cats: cn(main, 'column-align-both mt-2 -ml-14 pr-0'),
  }
}
