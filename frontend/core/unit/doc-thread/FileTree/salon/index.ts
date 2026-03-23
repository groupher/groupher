import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'

type TProps = TSpace

export default function useSalon({ ...spacing }: TProps) {
  const { cn, margin } = useTwBelt()

  return {
    wrapper: cn('column relative', margin(spacing)),
  }
}
