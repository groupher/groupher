import { COLOR_NAME } from '~/const/colors'

import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { isLightTheme } = useTheme()
  const { cn, fg, bg, rainbow } = useTwBelt()

  return {
    wrapper: 'row-between absolute left-0 top-0 w-full h-8 px-3 trans-all-200',
    actions: 'row-center mt-1.5',
    dot: 'size-2 circle ml-2 brightness-125',
    redBg: rainbow(COLOR_NAME.RED, 'bg'),
    yellowBg: rainbow(COLOR_NAME.YELLOW, 'bg'),
    greenowBg: rainbow(COLOR_NAME.GREEN, 'bg'),
    moreIcon: cn('size-3.5 mt-1', rainbow(COLOR_NAME.GREEN, 'fill')),

    domain: cn(
      'row-center absolute left-1/2 top-2 mt-px -ml-7 w-max h-5 rounded-md px-3',
      rainbow(COLOR_NAME.GREEN, 'bg'),
      isLightTheme ? 'opacity-30' : cn(bg('card'), 'opacity-70'),
    ),

    domainText: cn(
      'text-xs',
      isLightTheme ? 'bold' : '',
      isLightTheme ? fg('button.fg') : fg('digest'),
    ),
  }
}
