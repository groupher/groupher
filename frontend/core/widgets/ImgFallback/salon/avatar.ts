import useTwBelt from '~/hooks/useTwBelt'
import type { TSizeSML, TSpace } from '~/spec'
import { getFontSize } from './metric/avatar'

export { cn } from '~/css'

type TProps = {
  size: TSizeSML
} & TSpace

export default function useSalon({ size, ...spacing }: TProps) {
  const { cn, rainbowSoft, margin, avatar, rainbow } = useTwBelt()

  return {
    wrapper: cn('align-both border-none s-full', margin(spacing), avatar()),
    name: cn('bold leading-none', getFontSize(size)),

    rainbowSoft,
    rainbow,
  }
}
