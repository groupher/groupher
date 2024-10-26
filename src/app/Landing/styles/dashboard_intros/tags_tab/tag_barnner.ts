import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, rainbow } = useTwBelt()

  return {
    wrapper: cn('mt-7 ml-1.5'),
    header: 'row',
    hashIcon: cn('size-3.5 mr-1 mt-px opacity-65', rainbow(COLOR_NAME.GREEN, 'fill')),
    title: cn('text-xs', fg('text.title')),
    desc: cn('text-xs mt-1.5 w-52 leading-relaxed', fg('text.digest')),
  }
}
