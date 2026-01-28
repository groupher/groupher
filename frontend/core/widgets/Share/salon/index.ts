import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, fg, margin, hover } = useTwBelt()

  const tipNote = cn('text-xs', fg('digest'))

  return {
    wrapper: cn('row-center gap-x-2 smoky-65', margin(spacing)),
    panel: 'p-1.5',
    qrTip: cn(tipNote, 'max-w-32 mt-3'),
    linkTip: cn(tipNote, 'text-xs'),
    iconBox: cn('size-7', hover('bg')),
    icon: cn('size-5', hover('icon')),
  }
}
