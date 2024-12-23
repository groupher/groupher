import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, margin, br, bg, fill } = useTwBelt()

  return {
    wrapper: cn('row-center-between pt-2 border-t', margin(spacing), br('divider')),
    arrowBox: cn('align-both group size-6 rounded pointer', `hover:${bg('hoverBg')}`),
    arrowIocn: cn(
      'size-3.5 ml-0.5 group-smoky-80 trans-all-200',
      fill('text.digest'),
      `group-hover:${fill('text.title')}`,
    ),
  }
}
