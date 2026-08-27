'use client'

import { useLocation, useNavigate } from '@tanstack/react-router'
import { useCallback, useMemo } from 'react'

import { parseDsbPathname, resolveDsbRoute } from '~/platform'

import { DOC_EDITOR_QUERY_PARAM } from '../constant'

const buildSearchObject = (searchParams: URLSearchParams): Record<string, string> => {
  const search: Record<string, string> = {}

  searchParams.forEach((value, key) => {
    search[key] = value
  })

  return search
}

/** Exposes doc editor url state and actions through the shared React hook boundary. */
export default function useDocEditorUrl(): {
  currentDocId: string | null
  syncDocIdToUrl: (docId: string | null) => void
} {
  const { pathname, searchStr } = useLocation()
  const navigate = useNavigate()
  const routeMeta = useMemo(() => parseDsbPathname(pathname), [pathname])
  const currentSearch = new URLSearchParams(searchStr)
  const currentDocId = currentSearch.get(DOC_EDITOR_QUERY_PARAM.DOC_ID)

  const syncDocIdToUrl = useCallback(
    (docId: string | null): void => {
      if (!routeMeta) return

      const nextPath = resolveDsbRoute(
        {
          app: 'dsb',
          community: routeMeta.community,
          path: routeMeta.segments.join('/'),
        },
        {},
      )

      const nextSearch = buildSearchObject(new URLSearchParams(currentSearch.toString()))

      if (docId) {
        nextSearch[DOC_EDITOR_QUERY_PARAM.DOC_ID] = docId
      } else {
        delete nextSearch[DOC_EDITOR_QUERY_PARAM.DOC_ID]
      }

      const nextSearchParams = new URLSearchParams(nextSearch)
      const nextSearchString = nextSearchParams.toString()
      const nextUrl = nextSearchString ? `${nextPath}?${nextSearchString}` : nextPath
      const currentUrl = searchStr ? `${pathname}${searchStr}` : pathname

      if (nextUrl === currentUrl) return

      void navigate({ to: nextUrl as never, replace: true })
    },
    [currentSearch, navigate, pathname, routeMeta, searchStr],
  )

  return { currentDocId, syncDocIdToUrl }
}
