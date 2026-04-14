import Link from 'next/link'
import type { FC } from 'react'
import { THREAD_PATH } from '~/const/thread'
import type { TPost } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useSalon from '../salon/quora_layout'
import Footer from './Footer'
import Header from './Header'

type TProps = {
  article: TPost
}

const PostItem: FC<TProps> = ({ article }) => {
  const s = useSalon()
  const { slug } = useCommunity()

  return (
    <article className={s.wrapper}>
      <Header article={article} />
      <Link
        className={s.digest}
        href={`/${slug}/${THREAD_PATH.POST}/${article.innerId}`}
        scroll={false}
        data-preview-id={String(article.innerId)}
      >
        {article.digest}
      </Link>
      <Footer article={article} />
    </article>
  )
}

export default PostItem
