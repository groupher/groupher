import { BANNER_LAYOUT, CHANGELOG_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { isLightTheme } = useTheme()
  const { cn, fg, sexyBorder } = useTwBelt()
  const { globalLayout, changelogLayout } = useLayout()

  const isSidebarLayout = globalLayout === BANNER_LAYOUT.SIDEBAR
  const alignLeft = changelogLayout === CHANGELOG_LAYOUT.SIMPLE

  return {
    wrapper: cn('column-center', isSidebarLayout ? 'w-auto' : 'w-full'),
    banner: cn(
      'column-align-both h-48 w-8/12 mb-5 relative',
      alignLeft ? 'items-start pl-48' : 'items-center',
    ),
    divider: cn(
      'w-52 absolute bottom-px',
      sexyBorder(),
      isLightTheme ? 'brightness-95' : 'brightness-125',
    ),
    tabs: cn('absolute bottom-0 z-10', alignLeft && 'left-44'),
    //
    title: cn('text-2xl mb-1.5 -mt-9', fg('title')),
    desc: cn('text-base opacity-80', fg('digest')),
    main: 'w-8/12 mt-3',
  }
}
