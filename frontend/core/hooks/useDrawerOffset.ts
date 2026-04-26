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
    let cancelled = false
    let raf = 0

    const read = () => {
      const raw = getCSSVar(`container-${metric}-width`)
      if (!raw) return false
      if (!raw.endsWith('px')) return false

      const n = Number(raw.slice(0, -2))
      if (Number.isNaN(n)) return false

      lastMaxWidthRef.current = n
      setMaxWidth(n)
      return true
    }

    // read on next frame to ensure CSS variables are applied
    if (!read()) {
      raf = requestAnimationFrame(() => {
        if (cancelled) return
        if (!read()) {
          setMaxWidth(lastMaxWidthRef.current)
        }
      })
    }

    return () => {
      cancelled = true
      if (raf) cancelAnimationFrame(raf)
    }
  }, [metric])

  return useMemo(() => {
    const fromContentEdge = windowWidth <= maxWidth
    const rightOffset = fromContentEdge ? '0px' : `${(windowWidth - maxWidth) / 2}px`
    return { rightOffset, fromContentEdge }
  }, [windowWidth, maxWidth])
}

export default useDrawerOffset
