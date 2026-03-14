'use client'

import { usePathname } from 'next/navigation'
import METRIC from '~/const/metric'
import { THREAD } from '~/const/thread'
import useMetric from '~/hooks/useMetric'

import type { TThread } from '~/spec'

const isThread = (value: string): value is TThread => {
  return Object.values(THREAD).includes(value as TThread)
}

const getThreadFromPathname = (pathname: string): TThread | null => {
  const segments = pathname.split('/').filter(Boolean)
  const maybeThread = segments.at(-1)

  if (maybeThread && isThread(maybeThread)) {
    return maybeThread
  }

  return null
}

export default function useViewingThread(): TThread {
  const pathname = usePathname()

  const metric = useMetric()
  if (metric === METRIC.LANDING) {
    return THREAD.POST
  }
  const thread = getThreadFromPathname(pathname)

  return thread ?? THREAD.POST
}
