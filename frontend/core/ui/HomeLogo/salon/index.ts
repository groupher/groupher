import { cn } from '~/css'
import { cachedMargin } from '~/hooks/useTwBelt/constant'
import type { TSpace } from '~/spec'

type TProps = {
  size: number
} & TSpace

export default function useSalon({ size, ...spacing }: TProps) {
  return {
    logo: cn(`size-${size}`, cachedMargin(spacing)),
    //
  }
}
