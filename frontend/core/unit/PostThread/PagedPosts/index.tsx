'use client'

/*
 *
 * PagedArticles
 *
 */

import { useLocation, useNavigate } from '@tanstack/react-router'
import { type FC, memo } from 'react'

import URL_PARAM from '~/const/url_param'
import usePagedPosts from '~/hooks/usePagedPosts'
import useURLSearchParams from '~/hooks/useURLSearchParams'
import Pagi from '~/ui/Pagi'

import PostList from './PostList'
import useSalon from './salon'

const PagedPosts: FC = () => {
  const s = useSalon()
  const { pagedPosts } = usePagedPosts()
  const { pathname } = useLocation()
  const searchParams = useURLSearchParams()
  const navigate = useNavigate()

  const changePage = (page: number) => {
    const next = new URLSearchParams(searchParams.toString())
    if (page <= 1) next.delete(URL_PARAM.PAGE)
    else next.set(URL_PARAM.PAGE, String(page))
    const query = next.toString()
    void navigate({ to: (query ? `${pathname}?${query}` : pathname) as never })
  }

  return (
    <div className={s.wrapper}>
      <PostList />
      <Pagi {...pagedPosts} onChange={changePage} top={80} bottom={30} />
    </div>
  )
}

export default memo(PagedPosts)
