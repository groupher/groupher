'use client'

import { type FC, useEffect, useCallback } from 'react'

import useViewingThread from '~/hooks/useViewingThread'
import { THREAD } from '~/const/thread'

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
     * this event is only hanle brower back/forward, current behavior is like producthunt
     */
    window.addEventListener('popstate', handleBrowserPopChange)

    return () => {
      window.removeEventListener('popstate', handleBrowserPopChange)
    }
  }, [handleBrowserPopChange, initAppVersion])

  return <></>
}

export default Mushroom
