import useTwBelt from '~/hooks/useTwBelt'

import { COLOR_NAME } from '~/const/colors'

import useBase from '..'

export { cn } from '~/css'

export default () => {
  const { cn, rainbow } = useTwBelt()
  const base = useBase()

  return {
    block: 'row-center row wrap relative w-full h-full',
    bar: cn(base.bar, 'h-1.5 w-20 opacity-40'),
    circle: cn(base.circle, 'size-3.5 opacity-40'),
    iconBox: cn('absolute align-both size-4 rounded mt-2 mr-5'),
    icon: 'size-2.5',

    red: rainbow(COLOR_NAME.RED, 'fill'),
    redBg: rainbow(COLOR_NAME.RED, 'bgSoft'),
    blue: rainbow(COLOR_NAME.BLUE, 'fill'),
    blueBg: rainbow(COLOR_NAME.BLUE, 'bgSoft'),
    green: rainbow(COLOR_NAME.GREEN, 'fill'),
    greenBg: rainbow(COLOR_NAME.GREEN, 'bgSoft'),
    brown: rainbow(COLOR_NAME.BROWN, 'fill'),
    brownBg: rainbow(COLOR_NAME.BROWN, 'bgSoft'),
    purple: rainbow(COLOR_NAME.PURPLE, 'fill'),
    purpleBg: rainbow(COLOR_NAME.PURPLE, 'bgSoft'),

    box: 'relative w-16 h-24',
    borderBox: cn(base.box, 'w-20 h-24'),
  }
}
