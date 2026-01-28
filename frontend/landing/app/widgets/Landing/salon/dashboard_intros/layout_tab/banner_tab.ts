import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'

export { cn } from '~/css'

type TProps = {
  color: TColorName
}

export default ({ color }: TProps) => {
  const { cn, fg, rainbow, sexyBorder } = useTwBelt()

  return {
    wrapper: cn('column w-full ml-4 mt-6'),
    divider: cn('-ml-2 opacity-80 w-11/12', sexyBorder()),
    itemsWrapper: 'row-center gap-x-5 w-full pb-3 px-1',
    item: cn('text-xs opacity-80', fg('digest')),
    itemActive: cn('bold-sm', rainbow(color, 'fg')),
  }
}
