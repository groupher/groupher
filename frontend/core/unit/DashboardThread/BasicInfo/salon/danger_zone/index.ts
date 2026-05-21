import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default function useSalon() {
  const { cn, rainbow, rainbowSoft, fg, bg, fill, br } = useTwBelt()

  return {
    wrapper: cn(
      'column w-full border rounded-2xl',
      rainbow(COLOR.RED, 'borderSoft'),
      rainbowSoft(COLOR.RED),
    ),
    dangerTitle: cn('text-base bold-sm mb-3.5 mt-3.5 ml-4', rainbow(COLOR.RED, 'fg')),
    item: cn('column items-start w-full py-6 px-4 border', br('divider'), bg('card')),
    title: cn('row-center w-full text-sm mb-2.5', fg('title')),
    desc: cn('text-sm opacity-80', fg('digest')),
    icon: cn('size-4 ml-1 pointer', `hover: ${fill('title')}`, fill('digest')),
  }
}
