import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, br, fg, bg, shadow, rainbow } = useTwBelt()

  return {
    wrapper: cn(
      'row-center wrap absolute top-20 left-5 py-1 w-36 h-24 rounded-lg border z-50',
      br('divider'),
      bg('htmlBg'),
      shadow('sm'),
    ),
    block: 'relative w-1/2 h-10 px-2.5 py-0.5',
    title: cn('text-xs scale-90 -ml-1', fg('text.hint')),
    num: cn('row-center text-sm bold-sm overflow-hidden', fg('text.title')),

    icon: cn('size-3 ml-2'),
    iconGreen: rainbow(COLOR_NAME.GREEN, 'fill'),
    iconRed: rainbow(COLOR_NAME.RED, 'fill'),
  }
}
