import { type FC, memo } from 'react'

import type { TArticle, TArticleStats, TArticleViewerState } from '~/spec'

import ArticleBaseStats from '../ArticleBaseStats'
import useSalon from './salon/article_info'

type TProps = {
  article: TArticle
  stats: TArticleStats | null
  viewerState: TArticleViewerState
}

const ArticleInfo: FC<TProps> = ({ article, stats }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.baseWrapper}>
        <ArticleBaseStats article={article} stats={stats} container='drawer' />
      </div>
    </div>
  )
}

export default memo(ArticleInfo)
