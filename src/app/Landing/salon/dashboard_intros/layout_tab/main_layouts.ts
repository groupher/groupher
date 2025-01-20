import type { TColorName } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  color: TColorName
}

export default ({ color }: TProps) => {
  const { cn, fg, rainbow } = useTwBelt()

  return {
    wrapper: cn('column-align-both mt-8'),
    title: cn('text-xs', fg('text.digest')),
    layouts: 'row-center gap-x-4 mb-3',
    card: cn('relative w-28 h-28 rounded-md border', rainbow(color, 'borderSoft')),
    cardInactive: 'saturate-0 opacity-45',
    bar: cn('absolute h-1.5 w-8 rounded-md opacity-30', rainbow(color, 'bg')),
  }
}
