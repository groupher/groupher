import type { TColorName } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  color: TColorName
}

export default ({ color }: TProps) => {
  const { cn, fg, rainbow } = useTwBelt()

  return {
    wrapper: cn('column-align-both mt-10'),
    layouts: 'row-center gap-x-7 gap-y-4 mb-3',
    card: cn('relative w-24 h-14 rounded-md border', rainbow(color, 'borderSoft')),
    cardInactive: 'saturate-0 opacity-45',
    title: cn('text-xs', fg('text.digest')),
    //
    logo: cn('absolute size-5 circle opacity-25', rainbow(color, 'bg')),
    bar: cn('absolute h-2 w-8 rounded-md opacity-35', rainbow(color, 'bg')),
  }
}
