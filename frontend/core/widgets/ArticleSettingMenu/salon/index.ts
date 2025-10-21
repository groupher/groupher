import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, margin, bg, hover } = useTwBelt()

  return {
    wrapper: margin(spacing),
    settingBox: cn(' size-7', hover('bg')),
    settingBoxActive: cn(bg('hoverBg')),
    settingIcon: cn(
      'size-5 trans-all-200 rotate-45',
      'group-hover:rotate-180 group-smoky-80',
      hover('icon'),
    ),
  }
}
