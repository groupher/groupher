import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, bg, br, shadow, rainbow } = useTwBelt()

  return {
    wrapper: cn(
      'absolute top-2 w-20 h-36 border rounded-md p-1.5 z-30 trans-all-200 opacity-0',
      shadow('sm'),
      br('divider'),
      bg('htmlBg'),
    ),
    avatar: cn('size-5 z-40 circle border border-transparent absolute', shadow('sm')),
    brGreen: rainbow(COLOR_NAME.GREEN, 'border'),
    brBlue: rainbow(COLOR_NAME.BLUE, 'border'),
    brORange: rainbow(COLOR_NAME.ORANGE, 'border'),
    bar: cn('absolute left-2 w-12 h-1.5 rounded-md opacity-30', bg('text.digest')),
  }
}
