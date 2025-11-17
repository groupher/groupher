import { keys } from 'ramda'
import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'
import { TW_METRIC } from '~/tailwind'

export { cn } from '~/css'

const pageBgColors = TW_METRIC.pageBgColor

export default () => {
  const { cn, shadow, br, fg, primary, isBlackPrimary } = useTwBelt()
  const { theme } = useTheme()

  return {
    bgColors: keys(pageBgColors[theme]),
    bgColorsObj: pageBgColors[theme],
    rotateAngle: [
      6, 3, 2, 6, 12, 2, 3, 6, 12, 3, -2, 6, 12, 3, 2, -2, 6, 3, 12, 6, -3, 2, 3, 6, 12, 3, -2, 6,
      12, 3, 2, -2,
    ],
    wrapper: 'pb-7',
    themeGroup: 'row-center wrap gap-y-6 relative ml-4',
    block: cn(
      'group w-20 h-20 rounded-md -ml-4 border-2 px-2.5 py-2 trans-all-200',
      'hover:-mt-3  hover:z-10 hover:rotate-6 pointer',
      shadow('lg'),
      br('divider'),
    ),
    blockActive: cn(
      'column w-28 h-24 z-10 -mt-2 rotate-3 border-b-8 rounded-lg hover:-mt-2',
      primary('borderSoft'),
      isBlackPrimary && br('text.link'),
      shadow('xl'),
    ),
    colorTitle: cn('text-xs grow', fg('text.digest')),
    titleHint: cn('text-xs group-smoky-0', fg('text.digest')),
    hex: cn('text-xs', fg('text.hint')),
  }
}
