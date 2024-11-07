import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, rainbow, global, shadow, dimDark } = useTwBelt()

  return {
    wrapper: cn('column-align-both w-full h-full mb-20 overflow-hidden'),
    bannerTitle: cn('text-2xl bold-sm mt-5 mb-2', fg('text.title')),
    bannerDesc: cn('text-base', fg('text.digest')),
    //
    inner: 'row justify-center w-full gap-x-9 mt-14',
    toppingTitle: 'text-sm ml-px mb-2.5 z-20',
    fgGreen: rainbow(COLOR_NAME.GREEN, 'fg'),
    fgBrown: rainbow(COLOR_NAME.BROWN, 'fg'),
    fgPurple: rainbow(COLOR_NAME.PURPLE, 'fg'),
    desc: cn('text-sm ml-0.5 opacity-90', fg('text.title'), dimDark('sm')),
    //
    column:
      'group w-80 h-[680px] relative px-6 pt-5 rounded-t-3xl rounded-b-xl border border-transparent overflow-hidden',
    gradientGreen: cn(
      'absolute top-0 left-0 w-full h-full opacity-40 -z-10',
      global('gradient-green'),
    ),
    gradientOrange: cn(
      'absolute top-0 left-0 w-full h-full opacity-80 rotate-180 border border-dotted border-transparent -z-10',
      global('gradient-orange'),
    ),
    gradientPurple: cn(
      'absolute top-0 left-0 w-full h-full opacity-30 rotate-180 -z-10',
      global('gradient-purple'),
    ),
    board: cn(
      'w-72 h-[410px] mt-8 -ml-2 mb-5 px-4 py-5 z-30 rounded-t-xl rounded-b-xl',
      bg('card'),
      'trans-all-200',
      `group-hover:${shadow('sm')}`,
    ),
    //
    price: cn('row-center	mt-2.5 mb-1 -ml-1'),
    priceUnit: cn('text-2xl ml-2 mb-1 mt-1', fg('text.digest')),
    priceNum: cn('row items-center text-3xl bold-sm', fg('text.title')),
    priceDesc: cn('text-base ml-2 mt-1.5', fg('text.title')),
    //
    note: cn('text-xs z-10', fg('text.digest')),
    coffeeIcon: cn('size-5 mr-1.5 ml-px', rainbow(COLOR_NAME.PURPLE, 'fill')),
    tryButton: 'absolute bottom-5 left-7',
    letsTalk: cn('row-center text-xl z-20 mt-3.5 mb-2.5', fg('text.title')),
    //
    catPawImg: cn('absolute w-20 z-20 trans-jump', global('shape-shadow'), dimDark('lg')),
    catNote: cn('text-xs trans-jump z-10 ml-1', rainbow(COLOR_NAME.BROWN, 'fg')),
  }
}
