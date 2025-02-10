import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  noBorder?: boolean
} & TSpace

export default ({ noBorder, ...spacing }: TProps) => {
  const { cn, margin, br } = useTwBelt()

  return {
    wrapper: cn(
      'row-center rounded-md',
      noBorder ? 'border-0' : 'border',
      margin(spacing),
      br('divider'),
    ),
  }
}
