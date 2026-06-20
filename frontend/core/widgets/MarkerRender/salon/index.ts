import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'
import { cnMerge } from '~/css'

type TProps = {
  color?: TColorName
  className?: string
}

export default function useSalon({ color, className }: TProps) {
  const { rainbow } = useTwBelt()

  return {
    color: cnMerge('inline-block circle', color && rainbow(color, 'bg'), className),
  }
}
