import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, br, bg, fg, rainbow, shadow } = useTwBelt()

  return {
    wrapper: 'column w-full max-w-2xl mx-auto',
    items: 'column gap-5 w-full',
    actionRow: 'row-center gap-2',
    item: cn(
      'row-center text-xs rounded py-1 px-2.5 border trans-all-100',
      bg('card'),
      br('divider'),
      fg('digest'),
      `hover:${fg('title')}`,
      shadow('md'),
    ),
    deleteItem: cn(
      'row-center text-xs rounded py-1 px-2.5 border trans-all-100',
      bg('card'),
      br('divider'),
      shadow('md'),
      rainbow(COLOR.RED, 'fg'),
      `hover:${rainbow(COLOR.RED, 'fg')}`,
      `hover:${rainbow(COLOR.RED, 'bgSoft')}`,
    ),
    deleteIcon: cn('size-3 mr-1 opacity-65', rainbow(COLOR.RED, 'fill')),
  }
}
