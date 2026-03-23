import useTheme from '~/hooks/useTheme'

import useTwBelt from '~/hooks/useTwBelt'
import type { TSpace } from '~/spec'

type TProps = {
  className?: string
} & TSpace

export default function useSalon({ className, ...spacing }: TProps) {
  const { cn, margin } = useTwBelt()
  const { isLightTheme } = useTheme()

  return {
    wrapper: cn('prose', !isLightTheme && 'prose-invert', className, margin(spacing)),
  }
}
