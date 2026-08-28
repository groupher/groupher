'use client'

import { useLocation } from '@tanstack/react-router'

import METRIC from '~/const/metric'
import { THREAD, THREAD_PATH } from '~/const/thread'
import useMetric from '~/hooks/useMetric'
import type { TThread, TThreadPath } from '~/spec'
import { path2Thread } from '~/utils/thread'

const isThreadPath = (value: string): value is TThreadPath => {
  return Object.values(THREAD_PATH).includes(value as TThreadPath)
}

const getThreadFromPathname = (pathname: string): TThread | null => {
  const segments = pathname.split('/').filter(Boolean)
  const maybeThread = [...segments]
    .reverse()
    .find((segment): segment is TThreadPath => isThreadPath(segment))

  if (maybeThread) {
    return path2Thread(maybeThread)
  }

  return null
}

/** Exposes viewing thread state and actions through the shared React hook boundary. */
export default function useViewingThread(): TThread {
  const { pathname } = useLocation()

  const metric = useMetric()
  if (metric === METRIC.LANDING) {
    return THREAD.POST
  }
  const thread = getThreadFromPathname(pathname)

  return thread ?? THREAD.POST
}
