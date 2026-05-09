import type { FC } from 'react'

import type { TPost } from '~/spec'
import ArticleCatStatus from '~/unit/ArticleCatStatus'

import useSalon from '../salon/minimal_layout/footer'

type TProps = {
  article: TPost
}

const Footer: FC<TProps> = ({ article }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      {article.cat && <ArticleCatStatus right={18} cat={article.cat} status={article.status} />}
    </div>
  )
}

export default Footer
