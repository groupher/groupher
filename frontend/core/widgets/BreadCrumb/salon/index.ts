import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, fg, margin, hover } = useTwBelt()

  return {
    wrapper: cn('mb-2.5 -ml-0.5', margin(spacing)),
    li: 'row-center group',
    item: cn('text-xs py-0.5 px-1'),
    itemHover: cn(hover('bg'), hover('fg')),
    ol: 'row-center',
    curPath: cn('', fg('text.digest')),
    divider: cn('text-xs mx-1.5', fg('text.hint')),
  }
}
