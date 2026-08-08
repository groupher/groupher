import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = TSpace

export default function useSalon({ ...spacing }: TProps) {
  const { cn, margin } = useTwBelt()

  return {
    wrapper: cn('max-w-full', margin(spacing)),
    nav: 'inline-flex max-w-full items-center gap-1 whitespace-nowrap',
  }
}
