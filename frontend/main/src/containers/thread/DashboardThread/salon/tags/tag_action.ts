// import { Wrapper as BarWrapper } from './tag_bar'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fill, bg } = useTwBelt()

  return {
    wrapper: cn('row-center gap-x-1'),
    iconBox: cn('align-both size-4 pointer rounded', `hover:${bg('hoverBg')}`),
    icon: cn('size-3.5', `hover:${fill('text.title')}`, fill('text.digest')),
  }
}
