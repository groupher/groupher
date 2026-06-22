import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, rainbow } = useTwBelt()

  return {
    wrapper: cn(
      'column w-72 min-h-24 p-2.5 px-5 ml-5 mb-5',
      'border border-t-2 rounded',
      rainbow(COLOR.RED, 'border'),
      fg('digest'),
    ),
    title: cn('row-center wrap text-sm mb-3', fg('digest')),
    reason: fg('title'),
    content: 'row-center wrap',
    illegalItem: cn(
      'text-xs py-0.5 px-1.5 mr-2.5 -ml-0.5 mb-1.5 rounded',
      fg('title'),
      rainbow(COLOR.RED, 'borderSoft'),
    ),
  }
}
