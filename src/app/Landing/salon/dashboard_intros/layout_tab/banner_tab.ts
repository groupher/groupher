import type { TColorName } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  color: TColorName
}

export default ({ color }: TProps) => {
  const { cn, fg, rainbow, sexyHBorder } = useTwBelt()

  return {
    wrapper: cn('column w-full ml-4 mt-6'),
    divider: cn('-ml-2 opacity-80 w-11/12', sexyHBorder(35)),
    itemsWrapper: 'row-center gap-x-5 w-full pb-3 px-1',
    item: cn('text-xs opacity-80', fg('text.digest')),
    itemActive: cn('bold-sm', rainbow(color, 'fg')),
  }
}
