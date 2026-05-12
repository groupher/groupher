import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, bg, fg, rainbow } = useTwBelt()
  const wrapper = 'w-3/5 rounded-md px-3 py-2 text-xs mt-2'

  return {
    count: cn(wrapper, bg('sandBox'), fg('digest')),
    empty: cn(wrapper, rainbow(COLOR.RED, 'fg'), rainbow(COLOR.RED, 'bgSoft')),
  }
}
