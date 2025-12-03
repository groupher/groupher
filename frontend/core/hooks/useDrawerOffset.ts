import { getCSSVar } from '~/css'
import useWindowResize from '~/hooks/useWindowResize'

import useMetric from './useMetric'

type TRes = {
  rightOffset: string
  fromContentEdge: boolean
}
/**
 * NOTE: should use observer to wrap the component who use this hook
 */
const useDrawerOffset = (): TRes => {
  const metric = useMetric('lowercase')
  const { width: windowWidth } = useWindowResize()

  const containerWidth = getCSSVar(`container-${metric}-width`)

  const MAX_WIDTH = Number(containerWidth.slice(0, -2))

  return {
    rightOffset: `${windowWidth <= MAX_WIDTH ? '0' : (windowWidth - MAX_WIDTH) / 2}px`,
    fromContentEdge: windowWidth <= MAX_WIDTH,
  }
}

export default useDrawerOffset
