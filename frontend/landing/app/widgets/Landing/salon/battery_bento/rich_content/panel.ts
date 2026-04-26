import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, bg, br, shadow, rainbow, dimDark } = useTwBelt()

  return {
    wrapper: 'p-4 w-full h-80',
    content: cn(
      'column items-start relative mt-2.5 rounded-md p-2.5 w-full h-5/6 border',
      bg('card'),
      br('divider'),
      shadow('sm'),
    ),
    header: 'row-center relative',
    mention: cn('text-xs ml-2', rainbow(COLOR.BLUE, 'fg')),
    text: cn('text-xs ml-2 mt-0.5 z-10', fg('digest')),

    highlight: cn('absolute left-1 top-5 w-10 h-4 group-smoky-0', rainbow(COLOR.CYAN, 'bgSoft')),

    pic: cn('w-full h-16 mt-2 ml-2 object-cover	rounded-md opacity-50', dimDark()),
  }
}
