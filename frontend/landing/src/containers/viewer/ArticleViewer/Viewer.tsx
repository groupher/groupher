/*
 *
 * ArticleViewer
 *
 */

import { type FC, memo } from 'react'

import type { TArticle } from '~/spec'

import PostViewer from './PostViewer'

type TProps = {
  article: TArticle
}

const Viewer: FC<TProps> = ({ article }) => {
  const { meta } = article

  switch (meta.thread.toLowerCase()) {
    default: {
      // post, job, etc..
      return <PostViewer />
    }
  }
}

export default memo(Viewer)
