'use client'

import { type FC, useCallback, useEffect } from 'react'
import { THREAD } from '~/const/thread'
import useViewingThread from '~/hooks/useViewingThread'

import useLogic from './useLogic'

const Mushroom: FC = () => {
  const { initAppVersion } = useLogic()

  const curThread = useViewingThread()

  const handleBrowserPopChange = useCallback(
    (_) => {
      if (curThread === THREAD.POST) {
        // window.location = data.target.location.pathname
      }
    },
    [curThread],
  )

  useEffect(() => {
    initAppVersion()

    /**
     * this event is only handle browser back/forward, current behavior is like product-hunt
     */
    window.addEventListener('popstate', handleBrowserPopChange)

    return () => {
      window.removeEventListener('popstate', handleBrowserPopChange)
    }
  }, [handleBrowserPopChange, initAppVersion])

  return null
}

export default Mushroom
