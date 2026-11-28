'use client'

/*
 *
 * PagedArticles
 *
 */

import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { type FC, memo } from 'react'

import URL_PARAM from '~/const/url_param'
import useArticleListSearch from '~/hooks/useArticleListSearch'
import usePagedPosts from '~/hooks/usePagedPosts'
import usePagiConfig from '~/hooks/usePagiConfig'
import useTrans from '~/hooks/useTrans'
import useCommunity from '~/stores/community/hooks'
import useDsb from '~/stores/dsb/hooks'
import Pagi from '~/ui/Pagi'
import CursorPagination from '~/ui/Pagi/CursorPagination'

import PostList from './PostList'
import useSalon from './salon'

const PagedPosts: FC = () => {
  const s = useSalon()
  const {
    pagedPosts,
    paginationApi,
    paginationMode,
    hasNextPage,
    isFetchingNextPage,
    nextPageError,
    retryNextPage,
    fetchNextPage,
  } = usePagedPosts()
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
    <div className={s.wrapper} data-pagination-mode={paginationMode}>
      <PostList />
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
        <Pagi {...pagedPosts} onChange={changePage} top={80} bottom={30} />
      )}
    </div>
  )
}

export default memo(PagedPosts)
