import { COLOR } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, rainbow, shadow, dimDark, linkable } = useTwBelt()

  return {
    wrapper: 'column-align-both w-full h-full mb-14 overflow-hidden',
    bannerTitle: cn('text-2xl bold-sm mt-5 mb-2', fg('title')),
    bannerDesc: cn('text-base mb-14', fg('digest')),
    bannerNote: cn('text-base mb-8', fg('title')),
    //
    inner: 'row justify-center w-full gap-x-9',
    toppingTitle: 'text-sm ml-px mb-2.5 z-20',
    fgGreen: rainbow(COLOR.GREEN, 'fg'),
    fgBrown: rainbow(COLOR.BROWN, 'fg'),
    fgPurple: rainbow(COLOR.PURPLE, 'fg'),
    desc: cn('text-sm ml-0.5 opacity-90', fg('title'), dimDark('sm')),
    //
    column:
      'group w-80 h-[680px] relative px-6 pt-5 rounded-t-3xl rounded-b-xl border border-transparent overflow-hidden',
    gradientGreen: cn('absolute top-0 left-0 w-full h-full opacity-40 -z-10', 'gradient-green'),
    gradientOrange: cn(
      'absolute top-0 left-0 w-full h-full opacity-80 rotate-180 border border-dotted border-transparent -z-10',
      'gradient-orange',
    ),
    gradientPurple: cn(
      'absolute top-0 left-0 w-full h-full opacity-30 rotate-180 -z-10',
      'gradient-purple',
    ),
    board: cn(
      'w-72 h-[410px] mt-8 -ml-2 mb-5 px-4 py-5 z-30 rounded-t-xl rounded-b-xl',
      bg('card'),
      'trans-all-200',
      `group-hover:${shadow('sm')}`,
    ),
    //
    price: 'row-center	mt-2.5 mb-1 -ml-1',
    priceUnit: cn('text-2xl ml-2 mb-1 mt-1', fg('digest')),
    priceNum: cn('row items-center text-3xl bold-sm', fg('title')),
    priceDesc: cn('text-base ml-2 mt-1.5', fg('title')),
    //
    note: cn('text-xs z-10', fg('digest')),
    coffeeIcon: cn('size-5 mr-1.5 ml-px', rainbow(COLOR.PURPLE, 'fill')),
    tryButton: 'absolute bottom-5 left-7',
    letsTalk: cn('row-center text-xl z-20 mt-3.5 mb-2.5', fg('title')),
    //
    catPawImg: cn('absolute w-20 z-20 trans-jump shape-shadow', dimDark('lg')),
    catNote: cn('text-xs trans-jump z-10 ml-1', rainbow(COLOR.BROWN, 'fg')),
    //
    link: cn(linkable(), fg('link')),
  }
}
