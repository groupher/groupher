import { COLOR_NAME } from '~/const/colors'

import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { isLightTheme } = useTheme()
  const { cn, bg, shadow, rainbow } = useTwBelt()

  return {
    wrapper: cn(
      'column p-1.5 rounded-2xl w-[440px] h-[360px] absolute top-40 left-5',
      isLightTheme ? 'p-1.5' : 'p-2',
      isLightTheme ? bg('card') : bg('hoverBg'),
      isLightTheme ? shadow('sm') : shadow('md'),
    ),
    inner: 'w-full h-full rounded-xl relative gradient-red',
    bar: cn(
      'w-12 h-1.5 -ml-6 rounded-xl absolute top-4 left-1/2 opacity-15',
      rainbow(COLOR_NAME.RED, 'bg'),
    ),
    printIcon: cn('size-16 opacity-10 absolute right-2 top-2', rainbow(COLOR_NAME.RED, 'fill')),
  }
}
