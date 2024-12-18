/*
 *
 * PagedArticles
 *
 */

import { type FC, memo } from 'react'

import EVENT from '~/const/event'

import { send } from '~/signal'

import PostList from './PostList'
import useSalon from './styles'

import Pagi from '~/widgets/Pagi'

const PagedPosts: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <PostList />
      <Pagi onChange={(page) => send(EVENT.REFRESH_ARTICLES, { page })} top={80} bottom={30} />
    </div>
  )
}

export default memo(PagedPosts)
