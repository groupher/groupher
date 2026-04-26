import { type FC, useEffect, useState } from 'react'

import { THREAD_PATH } from '~/const/thread'
import usePreviewItemActive from '~/hooks/usePreviewItemActive'
import Img from '~/Img'
import { mockImage } from '~/mock'
import type { TPost } from '~/spec'

import ArticlePinLabel from '../../ArticlePinLabel'
import useSalon from '../salon/cover_layout'
import Footer from './Footer'
import Header from './Header'

type TProps = {
  article: TPost
  // onUserSelect?: (obj: TUser) => void
}

const DigestView: FC<TProps> = ({ article }) => {
  const isActive = usePreviewItemActive(article.innerId, THREAD_PATH.POST)
  const s = useSalon({ active: isActive })

  const [coverImg, setCoverImg] = useState('')

  useEffect(() => {
    setCoverImg(mockImage())
  }, [])

  return (
    <section className={s.wrapper}>
      <ArticlePinLabel isPinned={article.isPinned} className='top-8' />
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
