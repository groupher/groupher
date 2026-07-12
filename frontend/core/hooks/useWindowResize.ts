'use client'

import { useCallback, useEffect, useEffectEvent, useState } from 'react'

type TSize = {
  width?: number
  height?: number
}

/**
 * hooks for detect window size
 * see: https://usehooks.com/useWindowSize/ for details
 *
 * @returns
 */
const useWindowResize = (cb?: (size: TSize) => void): TSize => {
  const isClient = typeof window === 'object'

  const getSize = useCallback(() => {
    return {
      width: isClient ? window.innerWidth : undefined,
      height: isClient ? window.innerHeight : undefined,
    }
  }, [isClient])

  const [windowSize, setWindowSize] = useState(getSize)
  const notifyResize = useEffectEvent((size: TSize): void => {
    cb?.(size)
  })

  useEffect(() => {
    if (!isClient) {
      return
    }

    const handleResize = () => {
      const size = getSize()
      setWindowSize(size)
      notifyResize(size)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [getSize, isClient])

  return windowSize
}

export default useWindowResize
