import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

import useBase from '..'

export { cn, cnMerge } from '~/css'

export default function useSalon() {
  const { cnMerge, rainbow } = useTwBelt()
  const base = useBase()

  return {
    block: 'column s-full px-4 py-3',
    bar: cnMerge(base.bar, 'static h-1.5 w-20 opacity-40'),
    circle: cnMerge(base.circle, 'static size-3.5 opacity-40'),
    iconBox: 'align-both size-4 rounded',
    icon: 'size-2.5',

    cardsRows: 'column gap-4 w-fit self-center',
    cardsRow: 'row gap-2.5',
    cardBox: cnMerge(base.box, 'column justify-between border-none w-[4.75rem] h-[5.5rem] p-2'),
    cardBody: 'column gap-1.5',
    cardFooter: 'row-center justify-center h-3 rounded opacity-10',
    cardFooterBar: cnMerge(base.bar, 'h-1 w-8 opacity-30'),

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
  }
}
