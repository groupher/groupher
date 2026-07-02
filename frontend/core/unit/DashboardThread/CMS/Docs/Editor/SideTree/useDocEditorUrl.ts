import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'

import { DOC_EDITOR_QUERY_PARAM } from '../constant'
import { buildDocEditorUrl } from './helper'

export default function useDocEditorUrl(): {
  currentDocId: string | null
  syncDocIdToUrl: (docId: string | null) => void
} {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const searchString = searchParams.toString()
  const currentDocId = searchParams.get(DOC_EDITOR_QUERY_PARAM.DOC_ID)

  const syncDocIdToUrl = useCallback(
    (docId: string | null): void => {
      const nextUrl = buildDocEditorUrl(pathname, searchString, docId)
      const currentUrl = searchString ? `${pathname}?${searchString}` : pathname

      if (nextUrl === currentUrl) return

      router.replace(nextUrl, { scroll: false })
    },
    [pathname, router, searchString],
  )

  return { currentDocId, syncDocIdToUrl }
}
