import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

export default () => {
  const { rainbow } = useTwBelt()

  return {
    bar: 'absolute left-1 w-5 h-1 rounded-md opacity-40',

    purpleBg: rainbow(COLOR.PURPLE, 'bg'),
    blueBg: rainbow(COLOR.BLUE, 'bg'),
    redBg: rainbow(COLOR.RED, 'bg'),
    cyanBg: rainbow(COLOR.CYAN, 'bg'),
  }
}
