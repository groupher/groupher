import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, bg, br, fg, hover, rainbow, shadow } = useTwBelt()

  return {
    wrapper: 'w-full min-h-32 mt-4 pl-1.5 pr-0.5',
    imageSection: 'column w-full',
    imageArea: 'group column w-full',
    actionArea: 'row-center w-full pt-4',
    uploadActions:
      'row-center gap-3 translate-x-1 opacity-0 pointer-events-none transition-[opacity,transform] duration-150 ease-out group-hover:translate-x-0 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:translate-x-0 group-focus-within:opacity-100 group-focus-within:pointer-events-auto',
    actionButton: cn(
      'row-center gap-1 text-xs leading-none trans-all-100',
      fg('digest'),
      `hover:${fg('title')}`,
    ),
    actionIcon: cn('size-3 opacity-65 fill-current', fg('digest')),
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
      'row-center gap-1 text-xs leading-none trans-all-100',
      rainbow(COLOR.RED, 'fg'),
      `hover:${rainbow(COLOR.RED, 'fg')}`,
    ),
    deleteIcon: cn('size-3 opacity-65 fill-current', rainbow(COLOR.RED, 'fg')),
  }
}
