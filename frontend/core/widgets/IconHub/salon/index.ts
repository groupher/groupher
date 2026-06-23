import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'
import type { TSpace } from '~/spec'

type TProps = TSpace & {
  color?: TColorName
  size: number
  className?: string
  mode: 'sprite' | 'mask'
}

export default function useSalon({ color, size, className, mode, ...spacing }: TProps) {
  const { cn, margin, primary, rainbow, zise } = useTwBelt()
  const colorKey = mode === 'sprite' ? 'fg' : 'bg'
  const colorClass = color ? rainbow(color, colorKey) : className || primary(colorKey)

  return {
    wrapper: cn('inline-flex items-center justify-center leading-none', margin(spacing)),
    icon: cn(
      'block shrink-0',
      mode === 'mask' && 'mask-no-repeat mask-contain mask-center',
      zise(size),
      colorClass,
    ),
  }
}
