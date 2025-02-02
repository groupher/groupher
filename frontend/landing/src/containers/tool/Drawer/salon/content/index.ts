import { useMemo } from 'react'

import { NARROW_HEIGHT_OFFSET } from '../../constant'
import { isWideMode } from '../metrics'

import useTwBelt from '~/hooks/useTwBelt'

type TProps = {
  type: string
}

export default ({ type }: TProps) => {
  const { cn } = useTwBelt()

  const wrapperStyle = useMemo(
    () => ({
      height: isWideMode(type) ? '100vh' : `calc(100vh - ${NARROW_HEIGHT_OFFSET * 2}px)`,
    }),
    [type],
  )

  return {
    wrapper: cn('w-full overflow-y-auto'),
    wrapperStyle,
  }
}
