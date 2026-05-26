import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

export default function useSalon({ ...spacing }: TSpace) {
  const { cn, margin } = useTwBelt()

  return {
    wrapper: cn('inline-flex max-w-full items-center gap-2.5 whitespace-nowrap', margin(spacing)),
  }
}
