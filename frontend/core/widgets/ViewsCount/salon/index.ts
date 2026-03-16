import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = {
  isHighLight: boolean
} & TSpace

export default function useSalon({ isHighLight, ...spacing }: TProps) {
  const { cn, fg, fill, margin } = useTwBelt()

  return {
    wrapper: cn('row-center', isHighLight ? fg('digest') : fg('hint'), margin(spacing)),
    highLight: 'bg-clip-text bold-sm count-highlight',
    viewIcon: cn('size-3 mr-1', isHighLight ? fill('highlight') : fill('digest')),
    count: 'text-sm',
  }
}
