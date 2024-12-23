import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, margin, bg, fill } = useTwBelt()

  return {
    wrapper: margin(spacing),
    settingBox: cn('group align-both size-6 rounded pointer', `hover:${bg('hoverBg')}`),
    settingBoxActive: cn(bg('hoverBg')),
    settingIcon: cn(
      'size-4 trans-all-200 rotate-45',
      fill('text.digest'),
      'group-hover:rotate-90 group-smoky-80',
      `group-hover:${fill('text.title')}`,
    ),
  }
}
