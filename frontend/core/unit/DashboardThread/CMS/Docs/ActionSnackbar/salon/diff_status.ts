import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, fg, fill, hover, bg, rainbow } = useTwBelt()

  return {
    button: cn(
      'group row-center gap-1 h-7 px-2 rounded-lg button-reset text-xs bold-sm whitespace-nowrap',
      fg('digest'),
      hover('box'),
    ),
    buttonActive: cn(fg('title'), bg('hoverBg')),
    icon: cn('size-4.5', fill('digest'), hover('icon')),
    iconActive: fill('title'),
    additions: cn('ml-0.5', rainbow(COLOR.GREEN, 'fg')),
    deletions: rainbow(COLOR.RED, 'fg'),
  }
}
