import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { cn, rainbow } = useTwBelt()

  return {
    bar: cn('absolute left-1 w-5 h-1 rounded-md opacity-40'),

    purpleBg: rainbow(COLOR_NAME.PURPLE, 'bg'),
    blueBg: rainbow(COLOR_NAME.BLUE, 'bg'),
    redBg: rainbow(COLOR_NAME.RED, 'bg'),
    cyanBg: rainbow(COLOR_NAME.CYAN, 'bg'),
  }
}
