import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = TSpace

export default function useSalon(spacing: TProps) {
  const { margin } = useTwBelt()

  return {
    wrapper: margin(spacing),
  }
}
