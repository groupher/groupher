'use client'

import { Link, useLocation, useNavigate } from '@tanstack/react-router'

import { COMMUNITY_LAYOUT } from '~/const/layout'
import URL_PARAM from '~/const/url_param'
import useArticleListSearch from '~/hooks/useArticleListSearch'
import useLayout from '~/hooks/useLayout'
import usePagedChangelogs from '~/hooks/usePagedChangelogs'
import usePagiConfig from '~/hooks/usePagiConfig'
import useTrans from '~/hooks/useTrans'
import useCommunity from '~/stores/community/hooks'
import useDsb from '~/stores/dsb/hooks'
import Pagi from '~/ui/Pagi'
import CursorPagination from '~/ui/Pagi/CursorPagination'
import PaginationError from '~/ui/Pagi/PaginationError'

import ClassicLayout from './ClassicLayout'
import SimpleLayout from './SimpleLayout'

/** Renders the changelog surface inside the selected pagination provider. */
export default function ChangelogSurface() {
  const { communityLayout } = useLayout()
  const {
    pagedChangelogs,
    paginationApi,
    paginationMode,
    initialError,
    isRetryingInitial,
    retryInitial,
    hasNextPage,
    isFetchingNextPage,
    nextPageError,
    retryNextPage,
    fetchNextPage,
  } = usePagedChangelogs()
  const { pathname, hash } = useLocation()
  const searchParams = useArticleListSearch()
  const navigate = useNavigate()
  const { t } = useTrans()
  const { slug } = useCommunity()
  const { config } = usePagiConfig(useDsb(), slug)
  const showReturn = config.api === 'offset' && searchParams.has('after')
  const pageListUrl = () => {
    const next = new URLSearchParams(searchParams.toString())
    next.delete('after')
    next.delete('page')
    return Object.fromEntries(next.entries())
  }

  const changePage = (page: number) => {
    const next = new URLSearchParams(searchParams.toString())
    if (page <= 1) next.delete(URL_PARAM.PAGE)
    else next.set(URL_PARAM.PAGE, String(page))
    const query = next.toString()
    void navigate({ to: (query ? `${pathname}?${query}` : pathname) as never, hash })
  }

  return (
    <>
      {communityLayout === COMMUNITY_LAYOUT.HERO ? <ClassicLayout /> : <SimpleLayout />}
      {showReturn && (
        <Link to={pathname as never} search={pageListUrl() as never} hash={hash}>
          {t('pagination.return_to_pages')}
        </Link>
      )}
      {paginationApi === 'cursor' ? (
        <CursorPagination
          mode={paginationMode}
          hasNextPage={hasNextPage}
          isLoading={isFetchingNextPage}
          error={nextPageError}
          onRetry={() => void retryNextPage()}
          onLoadMore={() => void fetchNextPage()}
        />
      ) : (
        <Pagi {...pagedChangelogs} onChange={changePage} top={40} bottom={30} />
      )}
      {initialError && pagedChangelogs.entries.length === 0 && (
        <PaginationError isRetrying={isRetryingInitial} onRetry={() => void retryInitial()} />
      )}
    </>
  )
}
