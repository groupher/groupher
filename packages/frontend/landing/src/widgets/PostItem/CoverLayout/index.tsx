import { type FC, useState, useEffect } from 'react'

import type { TPost } from '~/spec'

import { previewArticle } from '~/signal'
import { mockImage } from '~/mock'

import ArticlePinLabel from '~/widgets/ArticlePinLabel'
import Img from '~/Img'

import Header from './Header'
import Footer from './Footer'

import useSalon from '../salon/cover_layout'

type TProps = {
  article: TPost
  // onUserSelect?: (obj: TUser) => void
}

const DigestView: FC<TProps> = ({ article }) => {
  const s = useSalon()

  const [coverImg, setCoverImg] = useState('')

  useEffect(() => {
    setCoverImg(mockImage())
  }, [])

  return (
    <section className={s.wrapper} onClick={() => previewArticle(article)}>
      <ArticlePinLabel isPinned={article.isPinned} className="top-8" />
      <div className={s.coverWrapper}>
        <Img src={coverImg} className={s.cover} />
      </div>
      <div className={s.main}>
        <Header article={article} />
        <div className={s.digest}>{article.digest}</div>
        <Footer article={article} />
      </div>
    </section>
  )
}

export default DigestView
