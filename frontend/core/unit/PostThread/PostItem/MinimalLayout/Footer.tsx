import type { FC } from 'react'

import type { TPost } from '~/spec'
import ArticleCatStatus from '~/unit/ArticleCatStatus'
import PostTicketProgress from '~/unit/PostTicketProgress'

import useSalon from '../salon/minimal_layout/footer'

type TProps = {
  article: TPost
  ticketProgress?: import('~/spec').TPostTicketProgress | null
}

const Footer: FC<TProps> = ({ article, ticketProgress }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      {article.cat && <ArticleCatStatus right={18} cat={article.cat} />}
      <PostTicketProgress progress={ticketProgress} cat={article.cat} />
    </div>
  )
}

export default Footer
