import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, fg, bg, br, shadow, rainbow } = useTwBelt()

  const activeBtn = cn(
    'bold-sm opacity-90',
    fg('button.fg'),
    `hover:${fg('button.fg')}`,
    shadow('sm'),
  )

  return {
    wrapper: cn('row-center-between wrap gap-x-3.5 gap-y-3 w-8/12 mb-10'),
    button: cn(
      'align-both text-sm min-w-20 h-8 px-3.5 rounded-xl border trans-all-100 pointer',
      `hover:${fg('text.title')}`,
      fg('text.digest'),
      bg('card'),
      br('divider'),
    ),
    purpleActive: cn(activeBtn, rainbow(COLOR_NAME.PURPLE, 'bg')),
    blueActive: cn(activeBtn, rainbow(COLOR_NAME.BLUE, 'bg')),
    cyanActive: cn(activeBtn, rainbow(COLOR_NAME.CYAN, 'bg')),
    greenActive: cn(activeBtn, rainbow(COLOR_NAME.GREEN, 'bg')),
    redActive: cn(activeBtn, rainbow(COLOR_NAME.RED, 'bg')),
    brownActive: cn(activeBtn, rainbow(COLOR_NAME.BROWN, 'bg')),
    yellowActive: cn(activeBtn, rainbow(COLOR_NAME.YELLOW, 'bg')),
  }
}
