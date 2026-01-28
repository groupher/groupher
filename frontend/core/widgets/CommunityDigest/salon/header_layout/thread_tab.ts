import { HEADER_LAYOUT } from '~/const/layout'
import useHeaderLinks from '~/hooks/useHeaderLinks'

import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, margin, br, fg, bg, primary, vividDark } = useTwBelt()

  const { layout } = useHeaderLinks()

  const floatWrapper = cn(
    'row-center gap-y-4 border rounded-2xl px-6 py-1.5 -ml-16 shadow-lg',
    br('divider'),
    bg('alphaBg'),
    margin(spacing),
  )

  const normalWrapper = cn('align-both grow gap-y-4 -ml-7', margin(spacing))
  const wrapper = layout === HEADER_LAYOUT.FLOAT ? floatWrapper : normalWrapper

  return {
    wrapper,
    title: cn(
      'row-center text-sm no-underline h-8 px-3.5 rounded pointer transition-colors',
      `hover:${primary('fg')}`,
      `hover:${bg('hoverBg')}`,
      `hover:${fg('title')}`,
      fg('digest'),
    ),
    titleActive: cn('bold-sm', `hover:${primary('fg')}`, primary('fg'), vividDark()),
  }
}
