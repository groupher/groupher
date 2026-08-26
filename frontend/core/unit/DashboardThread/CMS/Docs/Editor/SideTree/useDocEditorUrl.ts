'use client'

import { useCallback, useMemo } from 'react'

import { parseDsbPathname, resolveDsbRoute, useRouteScope } from '~/platform'

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
  const { navi } = useRouteScope()
  const routeMeta = useMemo(
    () => parseDsbPathname(navi.location.pathname, navi.dsbRootSegment ?? 'dash'),
    [navi.location.pathname, navi.dsbRootSegment],
  )
  const currentDocId = navi.location.searchParams.get(DOC_EDITOR_QUERY_PARAM.DOC_ID)

  const syncDocIdToUrl = useCallback(
    (docId: string | null): void => {
      if (!routeMeta) return

      const nextPath = resolveDsbRoute(
        {
          app: 'dsb',
          community: routeMeta.community,
          path: routeMeta.segments.join('/'),
        },
        { rootSegment: navi.dsbRootSegment ?? 'dash' },
      )

      const nextSearch = buildSearchObject(
        new URLSearchParams(navi.location.searchParams.toString()),
      )

      if (docId) {
        nextSearch[DOC_EDITOR_QUERY_PARAM.DOC_ID] = docId
      } else {
        delete nextSearch[DOC_EDITOR_QUERY_PARAM.DOC_ID]
      }

      const nextSearchParams = new URLSearchParams(nextSearch)
      const nextSearchString = nextSearchParams.toString()
      const nextUrl = nextSearchString ? `${nextPath}?${nextSearchString}` : nextPath
      const currentUrl = navi.location.search
        ? `${navi.location.pathname}${navi.location.search}`
        : navi.location.pathname

      if (nextUrl === currentUrl) return

      navi.to(
        {
          app: 'dsb',
          community: routeMeta.community,
          path: routeMeta.segments.join('/'),
          search: nextSearch,
        },
        { replace: true },
      )
    },
    [routeMeta, navi],
  )

  return { currentDocId, syncDocIdToUrl }
}
