// avold SSR to save first load build size
import { useRef, useEffect } from 'react'
import { useInView } from 'framer-motion'

// see details: https://www.framer.com/motion/use-in-view/
type TProps = {
  /**
   * Function called when waypoint enters viewport
   */
  onEnter: () => void
  /**
   * Function called when waypoint leaves viewport
   */
  onLeave?: () => void
  /**
   * Whether to activate on horizontal scrolling instead of vertical
   */
  horizontal?: boolean
  margin?: string
}

export default ({ onEnter, onLeave }: TProps) => {
  const ref = useRef(null)
  const isInView = useInView(ref)

  useEffect(() => {
    if (isInView) {
      onEnter?.()
    } else {
      onLeave?.()
    }
  }, [isInView, onEnter, onLeave])

  return <div ref={ref} />
}
