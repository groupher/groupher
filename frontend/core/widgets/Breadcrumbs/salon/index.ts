import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = TSpace

export default function useSalon({ ...spacing }: TProps) {
  const { cn, cnMerge, fg, margin, hover } = useTwBelt()

  return {
    wrapper: cnMerge('mb-2.5', margin(spacing)),
    li: 'row-center group',
    itemGroup: 'row-center',
    item: 'text-xs py-0.5 px-1',
    itemHover: cn(hover('bg'), hover('fg')),
    hoverShift: 'transition-transform duration-100 group-hover:translate-x-1',
    ol: 'row-center -ml-1',
    curPath: cn('', fg('digest')),
    divider: cn('text-xs mx-1.5', fg('hint')),
  }
}
