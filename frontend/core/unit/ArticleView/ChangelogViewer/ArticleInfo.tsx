import { type FC, memo } from 'react'

import type { TArticle } from '~/spec'

import ArticleBaseStats from '../ArticleBaseStats'
import useSalon from '../salon/changelog_viewer/article_info'

type TProps = {
  article: TArticle
}

const ArticleInfo: FC<TProps> = ({ article }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.baseWrapper}>
        <ArticleBaseStats article={article} container='drawer' />
      </div>
    </div>
  )
}

export default memo(ArticleInfo)
