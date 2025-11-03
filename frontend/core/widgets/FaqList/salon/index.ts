import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = TSpace

export default ({ ...spacing }: TProps) => {
  const { cn, margin } = useTwBelt()

  return {
    wrapper: cn('column-center w-full', margin(spacing)),
  }
}
