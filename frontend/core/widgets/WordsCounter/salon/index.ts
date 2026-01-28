import { COLOR_NAME } from '~/const/colors'

import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, fg, margin, rainbow } = useTwBelt()

  return {
    wrapper: cn('row items-end', margin(spacing)),
    hint: cn('text-xs opacity-80', fg('digest')),
    main: 'row items-end mx-1',
    //
    curNum: cn('text-sm', fg('title')),
    invalid: rainbow(COLOR_NAME.RED, 'fg'),
    slash: cn('text-xs ml-1.5 mb-px', fg('digest')),
    total: cn('text-xs', fg('digest')),
  }
}
