import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, br, bg, fill, shadow, rainbow } = useTwBelt()

  return {
    wrapper: cn(
      'column-align-both px-1.5 py-2 pb-0 rounded-t-xl z-50 border-t',
      'absolute left-4 ml-0.5',
      'brightness-150 trans-jump',
      bg('card'),
      shadow('xl'),
      br('divider'),
    ),
    fillOrange: rainbow(COLOR.ORANGE, 'fill'),
    top: 'row-center gap-x-1',
    actionBlock: cn('w-7 h-6 rounded-md align-both', bg('menuHoverBg')),
    bottomActions: cn('mt-1 w-24 p-1.5 rounded-t-md grow', bg('menuHoverBg')),
    //
    icon: cn('size-3', fill('title')),
    menuItem: cn('row-center mb-2 mt-0.5 ml-0.5 text-xs', fg('digest')),
    bar: cn('ml-2 w-8 h-1.5 rounded-md opacity-80', bg('text.digest')),
  }
}
