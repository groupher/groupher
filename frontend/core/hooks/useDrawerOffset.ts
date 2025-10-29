import twConfig from '~/const/twConfig.json'
import useWindowResize from '~/hooks/useWindowResize'

import useMetric from './useMetric'

const Container = twConfig.container

type TRes = {
  rightOffset: string
  fromContentEdge: boolean
}
/**
 * NOTE: should use observer to wrap the component who use this hook
 */
const useDrawerOffset = (): TRes => {
  const metric = useMetric()
  const { width: windowWidth } = useWindowResize()

  const MAX_WIDTH = Number(Container[metric.toLowerCase()].width.slice(0, -2))

  return {
    rightOffset: `${windowWidth <= MAX_WIDTH ? '0' : (windowWidth - MAX_WIDTH) / 2}px`,
    fromContentEdge: windowWidth <= MAX_WIDTH,
  }
}

export default useDrawerOffset
