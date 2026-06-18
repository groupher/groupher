import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'

type TProps = {
  color?: TColorName
  className?: string
}

export default function useSalon({ color, className }: TProps) {
  const { cn, rainbow } = useTwBelt()

  return {
    color: cn('inline-block circle', color && rainbow(color, 'bg'), className),
  }
}
