import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getCSSVar } from '~/css'
import useWindowResize from '~/hooks/useWindowResize'
import useMetric from './useMetric'

type TRes = {
  rightOffset: string
  fromContentEdge: boolean
}

const DEFAULT_MAX_WIDTH = 1280 // keep it sync with tailwind/tokens/container

const useDrawerOffset = (): TRes => {
  const metric = useMetric('lowercase')
  const { width: windowWidth } = useWindowResize()

  const lastMaxWidthRef = useRef<number>(DEFAULT_MAX_WIDTH)
  const [maxWidth, setMaxWidth] = useState<number>(DEFAULT_MAX_WIDTH)

  useLayoutEffect(() => {
    const raw = getCSSVar(`container-${metric}-width`)
    if (raw) {
      const n = Number(raw.slice(0, -2))
      if (!Number.isNaN(n)) {
        lastMaxWidthRef.current = n
        setMaxWidth(n)
        return
      }
    }

    // CSS may not ready, get it in next frame
    const raf = requestAnimationFrame(() => {
      const raw2 = getCSSVar(`container-${metric}-width`)
      if (raw2) {
        const n2 = Number(raw2.slice(0, -2))
        if (!Number.isNaN(n2)) {
          lastMaxWidthRef.current = n2
          setMaxWidth(n2)
        } else {
          setMaxWidth(lastMaxWidthRef.current)
        }
      } else {
        setMaxWidth(lastMaxWidthRef.current)
      }
    })

    return () => cancelAnimationFrame(raf)
  }, [metric])

  useLayoutEffect(() => {
    const raw = getCSSVar(`container-${metric}-width`)
    if (raw) {
      const n = Number(raw.slice(0, -2))
      if (!Number.isNaN(n)) {
        lastMaxWidthRef.current = n
        setMaxWidth(n)
      }
    }
  }, [metric])

  return useMemo(() => {
    const fromContentEdge = windowWidth <= maxWidth
    const rightOffset = fromContentEdge ? '0px' : `${(windowWidth - maxWidth) / 2}px`
    return { rightOffset, fromContentEdge }
  }, [windowWidth, maxWidth])
}

export default useDrawerOffset
