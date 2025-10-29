import { COLOR_NAME } from '~/const/colors'

import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { isDarkTheme } = useTheme()
  const { cn, bg, fg, landingTitle, rainbow, vividDark, br } = useTwBelt()

  return {
    wrapper: cn('column-align-both w-full relative mt-20'),
    slogan: 'column align-both mb-16',
    title: landingTitle(),
    desc: cn('text-lg mt-3', fg('text.digest'), isDarkTheme && 'opacity-65'),
    //
    wall: 'column-align-both relative w-full h-auto mt-6 debug',
    //
    paper: cn(
      'letter-paper column-align-both relative w-9/12 h-auto mt-12 px-4.5 border rounded-md',
      bg('card'),
      br('divider'),
    ),
    paperInner: cn('column-align-both pt-6 border-l border-r border-dashed', br('divider')),
    demoP: 'text-base leading-loose',
    p: 'mt-2.5',
    highlight: cn('px-1 bold-sm rounded', fg('text.digest'), vividDark()),
    // colors
    blueBg: cn('', rainbow(COLOR_NAME.BLUE, 'bgSoft')),
    greenBg: cn('', rainbow(COLOR_NAME.GREEN, 'bgSoft')),
    purpleBg: cn('', rainbow(COLOR_NAME.PURPLE, 'bgSoft')),
    orangeBg: cn('', rainbow(COLOR_NAME.ORANGE, 'bgSoft')),
    redBg: cn('', rainbow(COLOR_NAME.RED, 'bgSoft')),
    yellowBg: cn('', rainbow(COLOR_NAME.YELLOW, 'bgSoft')),
    brownBg: cn('', rainbow(COLOR_NAME.BROWN, 'bgSoft')),
    cyanBg: cn('', rainbow(COLOR_NAME.CYAN, 'bgSoft')),
    //
    bgGradient: cn(
      'absolute top-30 left-0 w-full h-full  transition-opacity duration-500 -z-10 border-b-none',
      'landing-gradient-gray',
    ),
  }
}
