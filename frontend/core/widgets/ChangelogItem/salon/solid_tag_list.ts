import { COLOR } from '~/const/colors'
import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'

type TProps = {
  color?: TColorName
}

export default ({ color = COLOR.BLACK }: TProps = {}) => {
  const { cn, fg, rainbow } = useTwBelt()

  return {
    wrapper: 'row-center gap-x-2 -ml-0.5',
    tag: cn('px-2.5 py-0.5 rounded-xl', rainbow(color, 'bgSoft')),
    name: cn('text-xs font-normal', fg('digest')),
  }
}
