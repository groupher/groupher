import { CHANGELOG_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { isLightTheme } = useTheme()
  const { cn, fg, sexyBorder } = useTwBelt()

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
      sexyBorder(),
    ),
    item: cn('text-sm', fg('digest')),
  }
}
