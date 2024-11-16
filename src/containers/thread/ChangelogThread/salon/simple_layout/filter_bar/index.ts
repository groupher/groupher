import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'
import useLayout from '~/hooks/useLayout'

import { CHANGELOG_LAYOUT } from '~/const/layout'

export default () => {
  const { isLightTheme } = useTheme()
  const { cn, fg, sexyHBorder } = useTwBelt()

  const { changelogLayout } = useLayout()
  const alignLeft = changelogLayout === CHANGELOG_LAYOUT.SIMPLE

  return {
    wrapper: cn(
      'relative align-both gap-x-4 w-8/12 h-16 mb-5 -mt-5',
      'animate-fade-down animate-duration-200',
      alignLeft && 'pl-48 justify-start',
    ),
    divider: cn(
      'absolute bottom-0',
      isLightTheme ? 'brightness-95' : 'brightness-125',
      sexyHBorder(35),
    ),
    item: cn('text-sm', fg('text.digest')),
  }
}
