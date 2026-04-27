import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'
import type { TSpace } from '~/spec'

type TProps = TSpace & {
  color?: TColorName
  size: number
}

export default function useSalon({ color, size, ...spacing }: TProps) {
  const { cn, margin, primary, rainbow, zise } = useTwBelt()

  return {
    wrapper: cn(margin(spacing)),
    icon: cn(
      'inline-block mask-no-repeat mask-contain mask-center',
      zise(size),
      color ? rainbow(color, 'bg') : primary('bg'),
    ),
  }
}
