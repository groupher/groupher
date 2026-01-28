import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, margin, br, bg, fill } = useTwBelt()

  return {
    wrapper: cn('row-between pt-2 border-t', margin(spacing), br('divider')),
    arrowBox: cn('align-both group size-6 rounded pointer', `hover:${bg('hoverBg')}`),
    arrowIocn: cn(
      'size-3.5 ml-0.5 group-smoky-80 trans-all-200',
      fill('digest'),
      `group-hover:${fill('title')}`,
    ),
  }
}
