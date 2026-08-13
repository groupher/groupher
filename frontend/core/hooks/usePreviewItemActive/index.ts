'use client'

import { useMemo } from 'react'

import { usePathname } from '~/platform'
import type { TThreadPath } from '~/spec'

type TRouteMatch = {
  innerId: string
  thread: string
}

const getRouteMatch = (pathname: string): TRouteMatch | null => {
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length < 3) return null

  const innerId = segments[segments.length - 1]
  const thread = segments[segments.length - 2]

  return { innerId, thread }
}

/** Exposes preview item active state and actions through the shared React hook boundary. */
export default function usePreviewItemActive(
  innerId: string | number,
  thread: TThreadPath,
): boolean {
  const pathname = usePathname()

  return useMemo(() => {
    const routeMatch = getRouteMatch(pathname)
    if (!routeMatch) return false

    return routeMatch.thread === thread && routeMatch.innerId === String(innerId)
  }, [innerId, pathname, thread])
}
