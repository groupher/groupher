import type { TSpace } from '~/spec'
import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  size: number
} & TSpace

export default function useSalon({ size, ...spacing }: TProps) {
  const { cn, zise, margin } = useTwBelt()

  return {
    logo: cn(zise(size), margin(spacing)),
    //
  }
}
