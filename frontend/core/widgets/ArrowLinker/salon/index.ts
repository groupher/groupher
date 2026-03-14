import usePrimaryColor from '~/hooks/usePrimaryColor'

import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName, TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = {
  color: TColorName | null
  noColor: boolean
  withSoftBg: boolean
} & TSpace

export default function useSalon({ color, noColor, withSoftBg, ...spacing }: TProps) {
  const { isLightTheme } = useTheme()
  const { cn, fg, fill, margin, primary, rainbow } = useTwBelt()

  const primaryColor = usePrimaryColor()

  const fgColor = color ? rainbow(color, 'fg') : primary('fg')
  const fillColor = color ? rainbow(color, 'fill') : primary('fill')

  return {
    wrapper: cn(
      'row-center group pr-1.5 pl-2.5 py-1.5 rounded-lg w-max	trans-all-100',
      `hover:${rainbow(color || primaryColor, 'bgSoft')}`,
      !isLightTheme && 'hover:brightness-125',
      !isLightTheme && !color && 'hover:brightness-95',
      withSoftBg && color && rainbow(color, 'bgSoft'),
      withSoftBg && !color && rainbow(primaryColor, 'bgSoft'),
      margin(spacing),
    ),
    title: cn('text-sm', noColor ? fg('digest') : fgColor, noColor && `group-hover:${fg('title')}`),
    arrowIcon2: cn(
      'size-3 ml-0.5 opacity-50 group-hover:opacity-100 group-hover:ml-1 group-hover:-mr-1 trans-all-100',
      noColor ? fill('digest') : fillColor,
    ),
    arrowIcon: cn(
      'size-3 ml-0.5 opacity-50 transition-all duration-150 ease-out',
      'group-hover:opacity-100',
      'group-hover:translate-x-1 group-hover:-translate-y-0.5',
      noColor ? fill('digest') : fillColor,
    ),
  }
}
