import type { TColorName, TSpace } from '~/spec'

import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  color: TColorName | null
  withSoftBg: boolean
} & TSpace

export default ({ color, withSoftBg, ...spacing }: TProps) => {
  const { isLightTheme } = useTheme()
  const { cn, margin, primary, rainbow } = useTwBelt()

  const fgColor = color ? rainbow(color, 'fg') : primary('fg')
  const fillColor = color ? rainbow(color, 'fill') : primary('fill')

  return {
    wrapper: cn(
      'row-center group pr-1.5 pl-2.5 py-1.5 rounded-lg w-max	trans-all-100',
      `hover:${rainbow(color, 'bgSoft')}`,
      !isLightTheme && 'hover:brightness-125',
      !isLightTheme && !color && 'hover:brightness-95',
      withSoftBg && color && rainbow(color, 'bgSoft'),
      margin(spacing),
    ),
    title: cn('text-sm', fgColor),
    arrowIcon: cn(
      'size-3 ml-0.5 opacity-50 group-hover:opacity-100 group-hover:ml-1 trans-all-100',
      fillColor,
    ),
  }
}
