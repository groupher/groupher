import type { FC } from 'react'

import type { TArticleStats, TPost } from '~/spec'
import type { TPostTicketProgress } from '~/spec'
import ArticleCatStatus from '~/unit/ArticleCatStatus'
import CommentsCount from '~/unit/CommentsCount'
import PostTicketProgress from '~/unit/PostTicketProgress'
import ViewsCount from '~/unit/ViewsCount'

import useSalon from '../salon/ph_layout/body'

type TProps = {
  article: TPost
  stats: TArticleStats | null
  ticketProgress?: TPostTicketProgress | null
}

const Body: FC<TProps> = ({ article, stats, ticketProgress }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.digest}>{article.digest}</div>
      <PostTicketProgress progress={ticketProgress} cat={article.cat} />
      <div className={s.footer}>
        {article.cat && <ArticleCatStatus cat={article.cat} right={18} top={1} left={-2} />}
        <ViewsCount count={stats?.views ?? 0} />
        <div className='mr-5' />
        {(stats?.commentsCount ?? 0) !== 0 && <CommentsCount count={stats?.commentsCount ?? 0} />}
      </div>
    </div>
  )
}

export default Body
