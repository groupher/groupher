import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, fill, hover, rainbow } = useTwBelt()

  return {
    button: cn(
      'group row-center gap-1 h-7 px-2 rounded-lg button-reset text-xs bold-sm whitespace-nowrap',
      fg('digest'),
      hover('box'),
    ),
    icon: cn('size-4.5', fill('digest'), hover('icon')),
    add: rainbow(COLOR.GREEN, 'fg'),
    remove: rainbow(COLOR.RED, 'fg'),
  }
}
