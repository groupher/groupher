import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fill, bg, rainbow, shadow } = useTwBelt()

  return {
    wrapper: 'absolute right-8 bottom-7 row justify-center wrap w-28 gap-2 ml-1.5 -mr-4',
    block: cn(
      'align-both size-8 rounded border border-dashed transition-transform duration-500',
      'opacity-65',
      rainbow(COLOR_NAME.BROWN, 'bgSoft'),
      rainbow(COLOR_NAME.BROWN, 'borderSoft'),
    ),
    blockSolid: cn('border-none opacity-100', bg('cardAlpha'), shadow('sm')),
    featureIcon: cn('size-4 opacity-80', fill('digest')),
  }
}
