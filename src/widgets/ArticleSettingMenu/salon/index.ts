import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, margin, bg, hoverable } = useTwBelt()

  return {
    wrapper: margin(spacing),
    settingBox: cn(' size-7', hoverable('bg')),
    settingBoxActive: cn(bg('hoverBg')),
    settingIcon: cn(
      'size-5 trans-all-200 rotate-45',
      'group-hover:rotate-180 group-smoky-80',
      hoverable('icon'),
    ),
  }
}
