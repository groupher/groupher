import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export { cn, cnMerge } from '~/css'

export default function useSalon() {
  const { cnMerge, rainbow } = useTwBelt()
  const base = useBase()

  return {
    block: 'row-center row wrap relative s-full',
    bar: cnMerge(base.bar, 'h-1.5 w-20 opacity-40'),
    circle: cnMerge(base.circle, 'size-3.5 opacity-40'),
    iconBox: 'absolute align-both size-4 rounded mt-2 mr-5',
    icon: 'size-2.5',

    red: rainbow(COLOR.RED, 'fill'),
    redBg: rainbow(COLOR.RED, 'bgSoft'),
    blue: rainbow(COLOR.BLUE, 'fill'),
    blueBg: rainbow(COLOR.BLUE, 'bgSoft'),
    green: rainbow(COLOR.GREEN, 'fill'),
    greenBg: rainbow(COLOR.GREEN, 'bgSoft'),
    brown: rainbow(COLOR.BROWN, 'fill'),
    brownBg: rainbow(COLOR.BROWN, 'bgSoft'),
    purple: rainbow(COLOR.PURPLE, 'fill'),
    purpleBg: rainbow(COLOR.PURPLE, 'bgSoft'),

    box: 'relative w-16 h-24',
    borderBox: cnMerge(base.box, 'w-20 h-24'),
  }
}
