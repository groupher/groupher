import { includes } from 'ramda'

import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'
import useLayout from '~/hooks/useLayout'
import { BANNER_LAYOUT } from '~/const/layout'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, margin, fg, bg, br, fill } = useTwBelt()
  const { bannerLayout } = useLayout()

  const normalWrapper = cn('row-center', margin(spacing))
  const withBgWrapper = cn(
    'row-center border h-8 w-44 rounded-lg px-2 py-1.5 pointer shadow-md',
    br('divider'),
    bg('alphaBg'),
    margin(spacing),
  )

  const isTabberLayout = bannerLayout === BANNER_LAYOUT.TABBER
  const wrapper = includes(bannerLayout, [BANNER_LAYOUT.SIDEBAR]) ? withBgWrapper : normalWrapper

  return {
    wrapper,
    hoverBox: cn(
      'align-both size-6 rounded border border-transparent pointer',
      isTabberLayout && bg('hoverBg'),
      `hover:${bg('hoverBg')}`,
      `hover:${br('divider')}`,
    ),
    nickname: cn('text-sm ml-2.5', fg('text.digest')),
    unLoginIcon: cn('size-3 pointer', fill('text.digest'), `hover:${fill('text.title')}`),
  }
}
