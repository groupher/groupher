import type { TColor, TColorName } from '~/spec'

import useTheme from '~/hooks/useTheme'
import useTwBelt from '~/hooks/useTwBelt'
import { useCallback } from 'react'

type TProps = TColor

export default ({ color }: TProps) => {
  const { isLightTheme } = useTheme()
  const { cn, fg, rainbow } = useTwBelt()

  const fillColor = useCallback((color: TColorName) => rainbow(color, 'fill'), [rainbow])
  const textColor = useCallback(
    (color: TColorName) => {
      return isLightTheme ? rainbow(color, 'fg') : fg('text.digest')
    },
    [rainbow, isLightTheme, fg],
  )

  return {
    wrapper: cn('row-center'),
    icon: cn('size-4 mr-3.5 opacity-65', fillColor(color)),
    text: cn('text-base brightness-90 opacity-90', textColor(color)),
  }
}
