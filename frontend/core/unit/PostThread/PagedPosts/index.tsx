'use client'

/*
 *
 * PagedArticles
 *
 */

import { type FC, memo } from 'react'

import URL_PARAM from '~/const/url_param'
import usePagedPosts from '~/hooks/usePagedPosts'
import { usePathname, useRouter, useSearchParams } from '~/platform'
import Pagi from '~/ui/Pagi'

import PostList from './PostList'
import useSalon from './salon'

const PagedPosts: FC = () => {
  const s = useSalon()
  const { pagedPosts } = usePagedPosts()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { push } = useRouter()

  const changePage = (page: number) => {
    const next = new URLSearchParams(searchParams.toString())
    if (page <= 1) next.delete(URL_PARAM.PAGE)
    else next.set(URL_PARAM.PAGE, String(page))
    const query = next.toString()
    push(query ? `${pathname}?${query}` : pathname)
  }

  return (
    <div className={s.wrapper}>
      <PostList />
      <Pagi {...pagedPosts} onChange={changePage} top={80} bottom={30} />
    </div>
  )
}

export default memo(PagedPosts)
