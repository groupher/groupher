// ref see example: https://codepen.io/mattbraun/pen/EywBJR

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn } = useTwBelt()

  return {
    wrapper: cn('relative mr-28 top-4 rotate-180'),
  }
}
