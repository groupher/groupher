/* eslint-disable react/display-name */

import { lazy, Suspense } from 'react'
// import { trackWindowScroll } from 'react-lazy-load-image-component'

import usePagedPosts from '~/hooks/usePagedPosts'
import { POST_LAYOUT } from '~/const/layout'
import TYPE from '~/const/type'
import { THREAD } from '~/const/thread'
import useLayout from '~/hooks/useLayout'

import PostItem from '~/widgets/PostItem'
import MasonryCards from '~/widgets/MasonryCards'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'

import useSalon from './salon/article_list'

export const EmptyThread = lazy(() => import('~/widgets/EmptyThread'))

export default () => {
  const s = useSalon()

  const { postLayout } = useLayout()
  const { pagedPosts, resState } = usePagedPosts()
  if (!pagedPosts) return null

  const { entries } = pagedPosts

  if (resState === TYPE.RES_STATE.LOADING && entries.length === 0) {
    return <LavaLampLoading top={20} left={30} />
  }

  // 加入 length 的判断是因为 Graphql 客户端如果有缓存的话会导致 RES_STATE 没有更新（因为没有请求）
  if (
    (resState === TYPE.RES_STATE.EMPTY && entries?.length === 0) ||
    (resState === TYPE.RES_STATE.DONE && entries?.length === 0)
  ) {
    return (
      <Suspense fallback={null}>
        <EmptyThread thread={THREAD.POST} />
      </Suspense>
    )
  }

  if (postLayout === POST_LAYOUT.MASONRY) {
    return (
      <div className={s.cards}>
        <MasonryCards column={2}>
          {entries.map((entry) => (
            <PostItem key={entry.innerId} article={entry} layout={postLayout} />
          ))}
        </MasonryCards>
      </div>
    )
  }

  return (
    <>
      {entries?.map((entry) => (
        <PostItem key={entry.innerId} article={entry} layout={postLayout} />
      ))}
    </>
  )
}
