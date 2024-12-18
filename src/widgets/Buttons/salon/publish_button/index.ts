import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'
import useLayout from '~/hooks/useLayout'

import { BANNER_LAYOUT } from '~/const/layout'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, fg, margin, fill } = useTwBelt()
  const { bannerLayout } = useLayout()

  return {
    wrapper: cn('row-center', margin(spacing)),
    pubBtn: cn('row relative justify-between bold w-full rounded-xl', fg('button.fg')),

    arrowBtn: cn('absolute h-full w-8 right-0'),
    arrowIcon: cn('size-3 rotate-90 opacity-40 z-30', fill('button.fg')),
    menuOffset: bannerLayout === BANNER_LAYOUT.HEADER ? [-95, 4] : [-80, 4],
  }
}
