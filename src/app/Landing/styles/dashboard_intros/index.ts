import { DASHBOARD_ROUTE } from '~/const/route'

import type { TIntroTab } from '../../DashboardIntros/spec'

import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  tab: TIntroTab
}

export default ({ tab }: TProps) => {
  const { cn, fg, global } = useTwBelt()

  const bgGradient = cn(
    'absolute top-0 left-0 w-full h-full opacity-0 transition-opacity duration-500 -z-10',
  )

  return {
    wrapper: cn('column-align-both w-full mt-20 mb-16'),
    slogan: 'column align-both mb-8',
    title: cn('text-3xl bold-sm opacity-70', fg('text.title'), global('text-shadow')),
    desc: cn('text-lg mt-3', fg('text.digest')),
    //
    content: 'column items-center relative w-full px-30 h-[720px]',
    inner: 'row-center-between w-8/12 h-full gap-x-10 pl-2 -mt-8',
    graphDemo: 'align-both w-1/2 h-full mr-2',

    bgGradientPurple: cn(
      bgGradient,
      global('landing-gradient-purple'),
      tab === DASHBOARD_ROUTE.LAYOUT && 'opacity-100',
    ),
    bgGradientBlue: cn(
      bgGradient,
      global('landing-gradient-blue'),
      tab === DASHBOARD_ROUTE.POST && 'opacity-100',
    ),
    bgGradientGreen: cn(
      bgGradient,
      global('landing-gradient-green'),
      tab === DASHBOARD_ROUTE.TAGS && 'opacity-100',
    ),
    bgGradientBrown: cn(
      bgGradient,
      global('landing-gradient-brown'),
      tab === DASHBOARD_ROUTE.HEADER && 'opacity-100',
    ),
    bgGradientRed: cn(
      bgGradient,
      global('landing-gradient-red'),
      tab === DASHBOARD_ROUTE.ADMINS && 'opacity-100',
    ),
    bgGradientCyan: cn(
      bgGradient,
      global('landing-gradient-cyan'),
      tab === DASHBOARD_ROUTE.SEO && 'opacity-100',
    ),
    bgGradientYellow: cn(
      bgGradient,
      global('landing-gradient-yellow'),
      tab === DASHBOARD_ROUTE.INOUT && 'opacity-100',
    ),
  }
}
