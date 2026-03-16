import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, br, shadow, rainbow, rainbowSoft } = useTwBelt()

  const activeBtn = cn(fg('title'), `hover:${fg('title')}`)

  return {
    wrapper: 'align-both wrap gap-x-3.5 gap-y-4 w-8/12 mb-10',
    button: cn(
      'align-both text-sm min-w-20 h-10 px-4.5 rounded-3xl border trans-all-100 pointer',
      `hover:${fg('title')}`,
      fg('digest'),
      br('divider'),
    ),

    iconBox: cn('size-6 align-both mr-3 rounded-md opacity-40', shadow('lg')),
    icon: 'size-4 fill-white',
    purpleIconBox: rainbow(COLOR.PURPLE, 'bg'),
    blueIconBox: rainbow(COLOR.BLUE, 'bg'),
    cyanIconBox: rainbow(COLOR.CYAN, 'bg'),
    greenIconBox: rainbow(COLOR.GREEN, 'bg'),
    redIconBox: rainbow(COLOR.RED, 'bg'),
    brownIconBox: rainbow(COLOR.BROWN, 'bg'),
    yellowIconBox: rainbow(COLOR.YELLOW, 'bg'),

    purpleActive: cn(activeBtn, rainbowSoft(COLOR.PURPLE)),
    blueActive: cn(activeBtn, rainbowSoft(COLOR.BLUE)),
    cyanActive: cn(activeBtn, rainbowSoft(COLOR.CYAN)),
    greenActive: cn(activeBtn, rainbowSoft(COLOR.GREEN)),
    redActive: cn(activeBtn, rainbowSoft(COLOR.RED)),
    brownActive: cn(activeBtn, rainbowSoft(COLOR.BROWN)),
    yellowActive: cn(activeBtn, rainbowSoft(COLOR.YELLOW)),
  }
}
