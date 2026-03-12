import Link from 'next/link'
import type { FC } from 'react'
import { THREAD } from '~/const/thread'
import useCommunity from '~/hooks/useCommunity'
import type { TPost } from '~/spec'
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
      <Link className={s.digest} href={`/${slug}/${THREAD.POST}/${article.innerId}`} scroll={false}>
        {article.digest}
      </Link>
      <Footer article={article} />
    </article>
  )
}

export default PostItem
