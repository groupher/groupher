import { COLOR_NAME } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, br, shadow, rainbow, rainbowSoft } = useTwBelt()

  const activeBtn = cn(fg('title'), `hover:${fg('title')}`)

  return {
    wrapper: cn('align-both wrap gap-x-3.5 gap-y-4 w-8/12 mb-10'),
    button: cn(
      'align-both text-sm min-w-20 h-10 px-4.5 rounded-3xl border trans-all-100 pointer',
      `hover:${fg('title')}`,
      fg('digest'),
      br('divider'),
    ),

    iconBox: cn('size-6 align-both mr-3 rounded-md opacity-40', shadow('lg')),
    icon: cn('size-4 fill-white'),
    purpleIconBox: rainbow(COLOR_NAME.PURPLE, 'bg'),
    blueIconBox: rainbow(COLOR_NAME.BLUE, 'bg'),
    cyanIconBox: rainbow(COLOR_NAME.CYAN, 'bg'),
    greenIconBox: rainbow(COLOR_NAME.GREEN, 'bg'),
    redIconBox: rainbow(COLOR_NAME.RED, 'bg'),
    brownIconBox: rainbow(COLOR_NAME.BROWN, 'bg'),
    yellowIconBox: rainbow(COLOR_NAME.YELLOW, 'bg'),

    purpleActive: cn(activeBtn, rainbowSoft(COLOR_NAME.PURPLE)),
    blueActive: cn(activeBtn, rainbowSoft(COLOR_NAME.BLUE)),
    cyanActive: cn(activeBtn, rainbowSoft(COLOR_NAME.CYAN)),
    greenActive: cn(activeBtn, rainbowSoft(COLOR_NAME.GREEN)),
    redActive: cn(activeBtn, rainbowSoft(COLOR_NAME.RED)),
    brownActive: cn(activeBtn, rainbowSoft(COLOR_NAME.BROWN)),
    yellowActive: cn(activeBtn, rainbowSoft(COLOR_NAME.YELLOW)),
  }
}
