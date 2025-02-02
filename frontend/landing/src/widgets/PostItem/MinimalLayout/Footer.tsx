import type { FC } from 'react'

import type { TPost } from '~/spec'

import ArticleCatState from '~/widgets/ArticleCatState'

import useSalon from '../salon/minimal_layout/footer'

type TProps = {
  article: TPost
}

const Footer: FC<TProps> = ({ article }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      {article.cat && <ArticleCatState right={18} cat={article.cat} state={article.state} />}
    </div>
  )
}

export default Footer
