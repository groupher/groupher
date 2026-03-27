import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = {
  size: number
} & TSpace

export default function useSalon({ size, ...spacing }: TProps) {
  const { cn, zise, margin, subPrimary, vividDark } = useTwBelt()

  return {
    wrapper: cn('circle opacity-80', zise(size), margin(spacing), subPrimary('bg'), vividDark()),
  }
}
