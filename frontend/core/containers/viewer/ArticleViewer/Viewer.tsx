/*
 *
 * ArticleViewer
 *
 */

import { type FC, memo } from 'react'

import type { TArticle } from '~/spec'
import ChangelogViewer from './ChangelogViewer'
import PostViewer from './PostViewer'

type TProps = {
  article: TArticle
  mode?: 'lite' | 'full'
}

const Viewer: FC<TProps> = ({ article, mode = 'full' }) => {
  const { meta } = article

  switch (meta.thread.toLowerCase()) {
    case 'changelog': {
      return <ChangelogViewer mode={mode} />
    }
    default: {
      // post, job, etc..
      return <PostViewer mode={mode} />
    }
  }
}

export default memo(Viewer)
