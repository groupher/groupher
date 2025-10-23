import type { FC } from 'react'
import { previewArticle } from '~/signal'
import type { TPost } from '~/spec'
import useSalon from '../salon/quora_layout'
import Footer from './Footer'
import Header from './Header'

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
