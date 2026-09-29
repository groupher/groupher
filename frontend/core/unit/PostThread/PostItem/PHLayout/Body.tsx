import type { FC } from 'react'

import type { TArticleStats, TPost } from '~/spec'
import ArticleCatStatus from '~/unit/ArticleCatStatus'
import CommentsCount from '~/unit/CommentsCount'
import ViewsCount from '~/unit/ViewsCount'

import useSalon from '../salon/ph_layout/body'

type TProps = {
  article: TPost
  stats: TArticleStats | null
}

const Body: FC<TProps> = ({ article, stats }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.digest}>{article.digest}</div>
      <div className={s.footer}>
        {article.cat && (
          <ArticleCatStatus
            cat={article.cat}
            status={article.status}
            right={18}
            top={1}
            left={-2}
          />
        )}
        <ViewsCount count={stats?.views} />
        <div className='mr-5' />
        {(stats?.commentsCount ?? 0) !== 0 && <CommentsCount count={stats?.commentsCount} />}
      </div>
    </div>
  )
}

export default Body
