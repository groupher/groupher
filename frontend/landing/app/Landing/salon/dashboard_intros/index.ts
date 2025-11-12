import { DASHBOARD_ROUTE } from '~/const/route'
import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'
import type { TIntroTab } from '../../DashboardIntros/spec'

type TProps = {
  tab: TIntroTab
}

export default ({ tab }: TProps) => {
  const { isDarkTheme } = useTheme()
  const { cn, fg, landingTitle } = useTwBelt()

  const bgGradient = cn(
    'absolute top-0 left-0 w-full h-full opacity-0 transition-opacity duration-500 -z-10',
  )

  return {
    wrapper: cn('column-align-both w-full mt-20 mb-16'),
    slogan: 'column align-both mb-8',
    title: landingTitle(),
    desc: cn('text-lg mt-3', fg('text.digest'), isDarkTheme && 'opacity-65'),
    //
    content: 'column items-center relative w-full px-30 h-[720px] overflow-hidden',
    inner: 'row-center-between w-10/12 h-full pl-16 -mt-8',
    graphDemo: 'align-both w-1/2 h-full mr-2',

    bgGradientPurple: cn(
      bgGradient,
      'landing-gradient-purple',
      tab === DASHBOARD_ROUTE.LAYOUT && 'opacity-100',
    ),
    bgGradientBlue: cn(
      bgGradient,
      'landing-gradient-blue',
      tab === DASHBOARD_ROUTE.POST && 'opacity-100',
    ),
    bgGradientGreen: cn(
      bgGradient,
      'landing-gradient-green',
      tab === DASHBOARD_ROUTE.TAGS && 'opacity-100',
    ),
    bgGradientBrown: cn(
      bgGradient,
      'landing-gradient-brown',
      tab === DASHBOARD_ROUTE.HEADER && 'opacity-100',
    ),
    bgGradientRed: cn(
      bgGradient,
      'landing-gradient-red',
      tab === DASHBOARD_ROUTE.ADMINS && 'opacity-100',
    ),
    bgGradientCyan: cn(
      bgGradient,
      'landing-gradient-cyan',
      tab === DASHBOARD_ROUTE.SEO && 'opacity-100',
    ),
    bgGradientYellow: cn(
      bgGradient,
      'landing-gradient-yellow',
      tab === DASHBOARD_ROUTE.INOUT && 'opacity-100',
    ),
  }
}
