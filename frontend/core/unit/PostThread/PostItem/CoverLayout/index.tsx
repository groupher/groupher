import { type FC, useState } from 'react'

import { THREAD_PATH } from '~/const/thread'
import usePreviewItemActive from '~/hooks/usePreviewItemActive'
import Img from '~/Img'
import { mockImage } from '~/mock'
import type { TArticleState, TPost } from '~/spec'

import ArticlePinLabel from '../../ArticlePinLabel'
import useSalon from '../salon/cover_layout'
import Footer from './Footer'
import Header from './Header'

type TProps = {
  viewModel: TArticleState<TPost>
  // onUserSelect?: (obj: TUser) => void
}

const DigestView: FC<TProps> = ({ viewModel }) => {
  const { content: article, stats, viewerState } = viewModel
  const isActive = usePreviewItemActive(article.innerId, THREAD_PATH.POST)
  const s = useSalon({ active: isActive })

  const [coverImg] = useState(() => mockImage())

  return (
    <section className={s.wrapper}>
      <ArticlePinLabel isPinned={article.isPinned} className='top-8' />
      <div className={s.coverWrapper}>
        <Img src={coverImg} className={s.cover} />
      </div>
      <div className={s.main}>
        <Header article={article} viewerState={viewerState} />
        <div className={s.digest}>{article.digest}</div>
        <Footer article={article} stats={stats} viewerState={viewerState} />
      </div>
    </section>
  )
}

export default DigestView
