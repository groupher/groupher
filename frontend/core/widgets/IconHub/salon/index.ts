import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'
import type { TSpace } from '~/spec'

type TProps = TSpace & {
  color?: TColorName
  size: number
  className?: string
}

export default function useSalon({ color, size, className, ...spacing }: TProps) {
  const { cn, margin, primary, rainbow, zise } = useTwBelt()
  const colorClass = color ? rainbow(color, 'bg') : className || primary('bg')

  return {
    wrapper: cn(margin(spacing)),
    icon: cn(
      'inline-block mask-no-repeat mask-contain mask-center',
      zise(size),
      colorClass,
    ),
  }
}
