import type { TSpace } from '~/spec'
import useTwBelt from '~/hooks/useTwBelt'

type TProps = TSpace

export default (spacing: TProps) => {
  const { cn, margin } = useTwBelt()

  return {
    wrapper: cn(margin(spacing)),
  }
}
