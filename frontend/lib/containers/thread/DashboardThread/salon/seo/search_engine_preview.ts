import { COLOR_NAME } from '~/const/colors'

import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, shadow, rainbow } = useTwBelt()
  const { isLightTheme } = useTheme()

  return {
    wrapper: cn(
      'column relative w-96 px-4 py-4 rounded-md -ml-2.5 mb-8',
      isLightTheme ? 'bg-[#fff]' : 'bg-[#1F1F1F]',
      shadow('md'),
    ),
    hint: cn('text-xs absolute right-2 top-2 scale-90', fg('text.hint')),
    url: cn('text-xs', fg('text.hint')),
    title: cn('text-xl mb-1 pt-1.5', rainbow(COLOR_NAME.BLUE)),
    desc: cn('text-sm line-clamp-2', fg('text.digest')),
  }
}
