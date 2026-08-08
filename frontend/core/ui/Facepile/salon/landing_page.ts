import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = { circle: boolean } & TSpace

export { cn } from '~/css'

export default function useSalon({ circle, ...spacing }: TProps) {
  const { cn, br, margin } = useTwBelt()

  return {
    wrapper: cn('row-center', margin(spacing)),
    avatar: cn(
      'border-2 text-xs size-6 text-center',
      circle ? 'circle' : 'rounded-md',

      br('divider'),
    ),
  }
}
