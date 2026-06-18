import useTwBelt from '~/hooks/useTwBelt'
import type { TColorName } from '~/spec'

type TProps = {
  active: boolean
  color?: TColorName
}

export default function useSalon({ active, color }: TProps) {
  const { cn, fg, primary, rainbow } = useTwBelt()
  const colorClass = color ? rainbow(color, 'fg') : primary('fg')

  return {
    // Provider sprite icons read color from currentColor.
    icon: active ? colorClass : cn(fg('digest'), `group-hover:${colorClass}`),
  }
}
