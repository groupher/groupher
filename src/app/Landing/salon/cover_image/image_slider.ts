import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { isLightTheme } = useTheme()
  const { cn, br, bg, fill, shadow } = useTwBelt()

  const navi = cn(
    'align-both group size-16 circle absolute bottom-72 transition-colors pointer z-30',
    `hover:${bg('hoverBg')}`,
  )
  const naviArrow = cn('size-10 opacity-25', 'group-hover:opacity-50', fill('text.digest'))

  return {
    wrapper: cn('column-center relative rounded-lg mt-16 ml-5', 'w-[1000px]', shadow('sm')),
    //
    leftNavi: cn(navi, '-left-36'),
    rightNavi: cn(navi, '-right-36'),
    leftArrow: cn(naviArrow),
    rightArrow: cn(naviArrow, 'rotate-180'),

    slideBox: cn('relative w-11/12 h-full rounded-t-lg'),
    slideImage: 'w-full h-[700px] overflow-hidden',
    coverImg: cn('object-cover w-full h-[788px] -mt-6 animation-fade-up'),
    //
    themeSwitch: cn(
      'absolute bottom-5 right-72 mr-8 align-both size-12 circle z-50 pointer',
      'animate-fade-up animate-duration-500',
      isLightTheme && 'brightness-95 hover:brightness-90',
      !isLightTheme && 'hover:brightness-110',
      'gap-x-4 backdrop-blur-sm opacity-20 trans-all-100',
      br('divider'),
      bg('alphaBg'),
    ),
    themeIcon: cn('size-5', fill('text.digest')),
  }
}
