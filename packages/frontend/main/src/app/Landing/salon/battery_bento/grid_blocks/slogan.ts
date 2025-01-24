import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, br, fill, rainbow } = useTwBelt()

  return {
    main: cn('w-80 text-center text-lg leading-8 mb-10', fg('text.digest')),
    topping: cn('align-both h-7 px-2.5 rounded-xl mb-4 border', br('divider'), fg('text.digest')),
    plugIcon: cn('size-4 mr-2 animate-pulse', fill('text.digest')),
    pointIcon: cn('size-6 inline-block rotate-180', rainbow(COLOR_NAME.ORANGE, 'fill')),
  }
}
