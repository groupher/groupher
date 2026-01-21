// import { Wrapper as BarWrapper } from './tag_bar'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, hover } = useTwBelt()

  return {
    wrapper: cn('row-center gap-x-1'),
    iconBox: cn('size-4', hover('bg')),
    icon: cn('size-3.5', hover('icon')),
  }
}
