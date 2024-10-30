import type { TColorName, TSpace } from '~/spec'

import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  color: TColorName | null
} & TSpace

export default ({ color, ...spacing }: TProps) => {
  const { isLightTheme } = useTheme()
  const { cn, margin, primary, rainbow } = useTwBelt()

  const fgColor = color ? rainbow(color, 'fg') : primary('fg')
  const fillColor = color ? rainbow(color, 'fill') : primary('fill')

  return {
    wrapper: cn(
      'row-center group pr-1.5 pl-2 py-1.5 rounded-lg trans-all-100',
      `hover:${rainbow(color, 'bgSoft')}`,
      // light theme collapse with two hover together, not sure if it's bug
      !isLightTheme && 'hover:brightness-125',
      margin(spacing),
    ),
    title: cn('text-sm', fgColor),
    arrowIcon: cn(
      'size-3 ml-0.5 opacity-50 group-hover:opacity-100 group-hover:ml-1 trans-all-100',
      fillColor,
    ),
  }
}
