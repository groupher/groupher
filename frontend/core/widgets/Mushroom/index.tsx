'use client'

import { type FC, useEffect, useRef } from 'react'

import { THREAD } from '~/const/thread'
import useViewingThread from '~/hooks/useViewingThread'

import useLogic from './useLogic'

const Mushroom: FC = () => {
  const { initAppVersion } = useLogic()

  const curThread = useViewingThread()

  const curThreadRef = useRef(curThread)
  curThreadRef.current = curThread

  useEffect(() => {
    initAppVersion()

    const handleBrowserPopChange = () => {
      if (curThreadRef.current === THREAD.POST) {
        // window.location = data.target.location.pathname
      }
    }

    /**
     * this event is only handle browser back/forward, current behavior is like product-hunt
     */
    window.addEventListener('popstate', handleBrowserPopChange)

    return () => {
      window.removeEventListener('popstate', handleBrowserPopChange)
    }
  }, [initAppVersion])

  return null
}

export default Mushroom
