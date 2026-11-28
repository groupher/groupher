import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from '@tanstack/react-router'
import { type PropsWithChildren, useCallback, useEffect, useRef, useState } from 'react'

import URL_PARAM from '~/const/url_param'
import { ArticleListSearchContext } from '~/hooks/useArticleListSearch'
import { recordPaginationEvent } from '~/lib/pagination/telemetry'
import PaginationError from '~/ui/Pagi/PaginationError'

import { refreshArticleBootstrap, resetArticleSurface } from '../query/articleSurface'
import PositionResetNotice from './PositionResetNotice'

type TProps = PropsWithChildren<{
  community: string
  surface: 'posts' | 'changelogs'
  recoveredSearch?: string
  recovery: 'bootstrap' | 'list' | null
}>

/** Keeps the Community shell hydrated while refreshing config before any list query can mount. */
export default function ArticlePageBoundary({
  children,
  community,
  surface,
  recovery,
  recoveredSearch,
}: TProps) {
  const client = useQueryClient()
  const [ready, setReady] = useState(!recovery)
  const [isRetrying, setRetrying] = useState(false)
  const [resetComplete, setResetComplete] = useState(false)
  const [showResetNotice, setShowResetNotice] = useState(recoveredSearch !== undefined)
  const { pathname, searchStr, hash } = useLocation()
  const navigate = useNavigate()
  const inFlight = useRef(false)
  const mounted = useRef(false)
  const recover = useCallback(async () => {
    if (inFlight.current) return
    if (recovery === 'list') {
      setReady(true)
      return
    }
    inFlight.current = true
    setRetrying(true)
    try {
      await refreshArticleBootstrap(client, community)
      if (!mounted.current) return
      resetArticleSurface(client, community, surface)
      const search = new URLSearchParams(searchStr)
      if (search.has(URL_PARAM.PAGE)) {
        search.delete(URL_PARAM.PAGE)
        const query = search.toString()
        await navigate({ to: (query ? `${pathname}?${query}` : pathname) as never, replace: true })
      }
      if (mounted.current) setReady(true)
    } catch {
      recordPaginationEvent({ surface, event: 'bootstrap_recovery' })
    } finally {
      inFlight.current = false
      if (mounted.current) setRetrying(false)
    }
  }, [client, community, surface, navigate, pathname, searchStr, recovery])
  useEffect(() => {
    mounted.current = true
    if (recovery === 'bootstrap') void recover()
    return () => {
      mounted.current = false
    }
  }, [recovery, recover])

  useEffect(() => {
    if (recoveredSearch === undefined) {
      setResetComplete(false)
      return
    }
    if (resetComplete) return
    if (new URLSearchParams(searchStr).toString() === recoveredSearch) {
      setResetComplete(true)
      return
    }
    setShowResetNotice(true)
    const query = recoveredSearch ? `?${recoveredSearch}` : ''
    const fragment = hash ? `#${hash}` : ''
    void navigate({ href: `${pathname}${query}${fragment}`, replace: true })
  }, [recoveredSearch, resetComplete, navigate, pathname, searchStr, hash])

  return ready ? (
    <ArticleListSearchContext.Provider
      value={
        !resetComplete &&
        recoveredSearch !== undefined &&
        new URLSearchParams(searchStr).toString() !== recoveredSearch
          ? recoveredSearch
          : undefined
      }
    >
      {showResetNotice && <PositionResetNotice />}
      {children}
    </ArticleListSearchContext.Provider>
  ) : (
    <PaginationError isRetrying={isRetrying} onRetry={() => void recover()} />
  )
}
