import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'
import { getFontSize } from './metric/avatar'

export { cn } from '~/css'

type TProps = {
  size: number
} & TSpace

export default ({ size, ...spacing }: TProps) => {
  const { cn, rainbowSoft, margin, avatar, rainbow } = useTwBelt()

  return {
    wrapper: cn('align-both border-none', `size-${size}`, margin(spacing), avatar()),
    name: cn('bold scale-75', getFontSize(size)),
    rainbowSoft,
    rainbow,
  }
}
