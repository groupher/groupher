'use client'

import { useLocation } from '@tanstack/react-router'

import { DSB_ROUTE } from '~/const/route'
import { parseDsbPathname } from '~/platform'

export type TDsbTabState = {
  mainTab: string
  subTab: string | null
}

/** Exposes dsb tab state and actions through the shared React hook boundary. */
export default function useDsbTab(): TDsbTabState {
  const { pathname } = useLocation()
  const meta = parseDsbPathname(pathname)
  const segments = meta ? meta.segments : []

  if (!meta) {
    return {
      mainTab: DSB_ROUTE.OVERVIEW,
      subTab: null,
    }
  }

  const rawMainTab = segments[0] ?? DSB_ROUTE.OVERVIEW
  const mainTab = rawMainTab
  const subTab = segments[1] ?? null

  return { mainTab, subTab }
}
