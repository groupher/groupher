import { COLOR } from '~/const/colors'

import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export default function useSalon() {
  const { cn, fg, shadow, rainbow } = useTwBelt()
  const { isLightTheme } = useTheme()

  return {
    wrapper: cn(
      'column relative w-full px-4 py-4 rounded-md mb-8',
      isLightTheme ? 'bg-[#fff]' : 'bg-[#1F1F1F]',
      shadow('md'),
    ),
    hint: cn('text-xs absolute right-2 top-2 scale-90', fg('hint')),
    url: cn('text-xs', fg('hint')),
    title: cn('text-xl mb-1 pt-1.5', rainbow(COLOR.BLUE)),
    desc: cn('text-sm line-clamp-2', fg('digest')),
  }
}
