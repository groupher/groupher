import { COLOR_NAME } from '~/const/colors'

import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { isLightTheme } = useTheme()
  const { cn, fg, fill, rainbow } = useTwBelt()

  return {
    wrapper: cn('column-align-both relative w-full h-64'),
    introTitle: cn('row-center text-lg mb-5 -ml-2.5', fg('text.title')),
    introLogo: cn('size-4 mr-2.5', fill('text.digest')),

    nextBtn: 'row-center justify-around w-52 absolute bottom-6',
    errorMsg: cn('absolute bottom-12 text-sm w-52', rainbow(COLOR_NAME.RED, 'fg')),
    prevBtn: cn('saturate-0', isLightTheme && 'opacity-80'),
  }
}
