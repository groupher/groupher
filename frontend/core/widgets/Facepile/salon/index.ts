import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

export { cn } from '~/css'

type TProps = { total: number } & TSpace

export default function useSalon({ total: _total, ...spacing }: TProps) {
  const { cn, margin } = useTwBelt()

  return {
    wrapper: cn('row-center list-none m-0 p-0', margin(spacing)),
  }
}
