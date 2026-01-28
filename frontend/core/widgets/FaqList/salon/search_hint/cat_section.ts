import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'

type TProps = {
  color: TColorName
}

export default ({ color }: TProps) => {
  const { cn, fg, rainbow } = useTwBelt()

  return {
    wrapper: 'w-5/12 pl-4 ml-0.5 mb-5 relative',
    bar: cn('absolute left-0 top-0 h-full w-1 rounded opacity-65', rainbow(color, 'bg')),
    catItem: cn('line-clamp text-sm no-underline', 'hover:underline', fg('title')),
    catDesc: cn('text-xs opacity-80 mt-0.5', fg('digest')),
  }
}
