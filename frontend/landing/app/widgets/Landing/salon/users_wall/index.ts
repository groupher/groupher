import { COLOR } from '~/const/colors'
import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { isDarkTheme } = useTheme()
  const { cn, bg, fg, landingTitle, rainbow, vividDark, br } = useTwBelt()

  return {
    wrapper: cn('column-align-both w-full relative pt-32', 'landing-gradient-gray'),
    slogan: 'column align-both mb-16',
    topping: cn(
      'text-xs border mb-3 px-3.5 py-1.5 rounded-lg',
      fg('title'),
      br('divider'),
      bg('card'),
    ),
    title: landingTitle(),
    desc: cn('text-lg mt-3', fg('digest'), isDarkTheme && 'opacity-65'),
    paper: cn(
      'letter-paper column-align-both relative w-9/12 h-auto px-4.5 border rounded-md',
      bg('card'),
      br('divider'),
    ),
    paperInner: cn(
      'column-align-both pt-6 border-l border-r',
      br('divider'),
      !isDarkTheme && 'border-dashed',
    ),
    demoP: 'text-base leading-loose',
    p: 'mt-2.5',
    highlight: cn('px-1 bold-sm rounded', fg('digest'), vividDark()),
    // colors
    blueBg: cn('', rainbow(COLOR.BLUE, 'bgLite')),
    greenBg: cn('', rainbow(COLOR.GREEN, 'bgLite')),
    purpleBg: cn('', rainbow(COLOR.PURPLE, 'bgLite')),
    orangeBg: cn('', rainbow(COLOR.ORANGE, 'bgLite')),
    redBg: cn('', rainbow(COLOR.RED, 'bgLite')),
    yellowBg: cn('', rainbow(COLOR.YELLOW, 'bgLite')),
    brownBg: cn('', rainbow(COLOR.BROWN, 'bgLite')),
    cyanBg: cn('', rainbow(COLOR.CYAN, 'bgLite')),
  }
}
