import { useCallback } from 'react'

import useTwBelt from '~/hooks/useTwBelt'
import type { TColor, TColorName } from '~/spec'

type TProps = TColor

export default function useSalon({ color }: TProps) {
  const { cn, fg, rainbow } = useTwBelt()

  const fillColor = useCallback((color: TColorName) => rainbow(color, 'fill'), [rainbow])

  return {
    wrapper: 'row-center mt-4',
    icon: cn('size-5 mr-3.5 opacity-65', fillColor(color)),
    text: cn('text-base', fg('digest')),
  }
}
