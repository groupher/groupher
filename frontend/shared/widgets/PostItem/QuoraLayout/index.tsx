import type { FC } from 'react'

import type { TPost } from '~/spec'

import { previewArticle } from '~/signal'

import Header from './Header'
import Footer from './Footer'

import useSalon from '../salon/quora_layout'

type TProps = {
  article: TPost
}

const PostItem: FC<TProps> = ({ article }) => {
  const s = useSalon()

  return (
    <article className={s.wrapper}>
      <Header article={article} />
      <div className={s.digest} onClick={() => previewArticle(article)}>
        {article.digest}
      </div>
      <Footer article={article} />
    </article>
  )
}

export default PostItem
