import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

import useBase from '../../salon'

type TProps = TSpace

export default function useSalon({ ...spacing }: TProps = {}) {
  const { cn, margin } = useTwBelt()
  const base = useBase()

  return {
    wrapper: cn(base.main, 'column-center w-full border-r-none', margin(spacing)),
  }
}
