import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, bg, br, fg, hover, rainbow, sexyBorder, shadow } = useTwBelt()

  return {
    wrapper: 'w-full min-h-32 mt-4 pl-1.5 pr-0.5',
    imageSection: 'column w-full',
    sectionDivider: cn(sexyBorder(), 'w-full mt-6'),
    actionArea: 'row-center justify-between gap-4 w-full pt-4',
    uploadActions: 'row-center gap-2',
    actionButton: cn(
      'row-center text-xs rounded py-1 px-2.5 border trans-all-100',
      bg('card'),
      br('divider'),
      fg('digest'),
      `hover:${fg('title')}`,
      shadow('md'),
    ),
    addImageButton: cn(
      'row-center gap-1.5 text-xs rounded py-1 px-2.5 border trans-all-100 disabled:cursor-not-allowed disabled:opacity-55',
      bg('card'),
      br('divider'),
      fg('digest'),
      hover('bg'),
      shadow('md'),
    ),
    addImageIcon: cn('size-3 opacity-65', fg('digest')),
    deleteButton: cn(
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
