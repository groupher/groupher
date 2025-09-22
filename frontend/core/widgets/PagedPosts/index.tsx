'use client'

/*
 *
 * PagedArticles
 *
 */

import RichEditor from '@groupher/rich-editor'
import React, { type FC, memo } from 'react'
import ReactDOM from 'react-dom'

import EVENT from '~/const/event'

import { send } from '~/signal'
import Pagi from '~/widgets/Pagi'

import PostList from './PostList'
import useSalon from './salon'

const PagedPosts: FC = () => {
  const s = useSalon()
  // console.log('## RichEditor: ', RichEditor)
  console.log(React.version, ReactDOM.version)

  return (
    <div className={s.wrapper}>
      <h2>hello</h2>
      <RichEditor />
      <PostList />
      <Pagi onChange={(page) => send(EVENT.REFRESH_ARTICLES, { page })} top={80} bottom={30} />
    </div>
  )
}

export default memo(PagedPosts)
