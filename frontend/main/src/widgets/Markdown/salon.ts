import type { TSpace } from '~/spec'

import useTwBelt from '~/hooks/useTwBelt'
import useTheme from '~/hooks/useTheme'

type TProps = {
  className?: string
} & TSpace

export default ({ className, ...spacing }: TProps) => {
  const { cn, margin } = useTwBelt()
  const { isLightTheme } = useTheme()

  return {
    wrapper: cn('prose', !isLightTheme && 'prose-invert', className, margin(spacing)),
  }
}
