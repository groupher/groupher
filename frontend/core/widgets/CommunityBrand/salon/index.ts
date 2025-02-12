import type { TSpace } from '~/spec'
import useTwBelt from '~/hooks/useTwBelt'

import useLayout from '~/hooks/useLayout'

import { BRAND_LAYOUT } from '~/const/layout'

type TProps = {
  className?: string
} & TSpace

export default ({ className, ...spacing }: TProps) => {
  const { cn, fg, margin } = useTwBelt()

  const { brandLayout } = useLayout()
  const noMargin = brandLayout === BRAND_LAYOUT.TEXT

  return {
    wrapper: cn('row-center', className, margin(spacing)),
    logo: 'size-5 -ml-px mr-1',
    title: cn(
      'text-base bold-sm grow max-w-[80px] line-clamp-1',
      noMargin && 'ml-2',
      fg('text.digest'),
    ),
    //
  }
}
