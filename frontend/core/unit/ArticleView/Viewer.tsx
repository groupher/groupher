/*
 *
 * ArticleViewer
 *
 */

import { type FC, memo } from 'react'

import { THREAD } from '~/const/thread'
import type { TArticle } from '~/spec'
import ChangelogViewer from './ChangelogViewer'
import PostViewer from './PostViewer'

type TProps = {
  article: TArticle
  isFullView?: boolean
}

const Viewer: FC<TProps> = ({ article, isFullView = true }) => {
  const { meta } = article

  switch (meta.thread) {
    case THREAD.CHANGELOG: {
      return <ChangelogViewer isFullView={isFullView} />
    }
    default: {
      // post, job, etc..
      return <PostViewer isFullView={isFullView} />
    }
  }
}

export default memo(Viewer)
