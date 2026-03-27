import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = {
  noBorder?: boolean
} & TSpace

export default function useSalon({ noBorder, ...spacing }: TProps) {
  const { cn, margin, br } = useTwBelt()

  return {
    wrapper: cn(
      'row-center rounded-md',
      noBorder ? 'border-0' : 'border',
      margin(spacing),
      br('divider'),
    ),
  }
}
