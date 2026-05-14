import Link from 'next/link'
import type { FC } from 'react'

import { THREAD_PATH } from '~/const/thread'
import { cutRest } from '~/fmt'
import usePreviewItemActive from '~/hooks/usePreviewItemActive'
import type { TArticle } from '~/spec'
import useCommunity from '~/stores/community/hooks'

import ArticleImgWindow from '../ArticleImgWindow'
import ArticlePinLabel from '../ArticlePinLabel'
import ArticleReadLabel from '../ArticleReadLabel'
import Footer from './Footer'
import useSalon from './salon'

type TProps = {
  data: TArticle
}

const ArticleCard: FC<TProps> = ({ data }) => {
  const isActive = usePreviewItemActive(data.innerId, THREAD_PATH.POST)
  const s = useSalon({ active: isActive })

  const { slug } = useCommunity()
  const { innerId, title, digest, isPinned, viewerHasViewed } = data

  return (
    <div className={s.wrapper}>
      <div className={s.pinHintDot}>
        <ArticlePinLabel isPinned={isPinned} />
      </div>

      <div className={s.viewHintDot}>
        <ArticleReadLabel viewed={viewerHasViewed} top={0} right={0} />
      </div>

      <div className='mt-1' />
      <Link
        className={s.titleLink}
        scroll={false}
        href={`/${slug}/${THREAD_PATH.POST}/${innerId}`}
        data-preview-id={String(innerId)}
      >
        {title}
      </Link>

      <Link
        scroll={false}
        href={`/${slug}/${THREAD_PATH.POST}/${innerId}`}
        data-preview-id={String(innerId)}
      >
        {cutRest(digest, 150)}
      </Link>

      <div className='mt-1' />
      <ArticleImgWindow />
      <div className='mt-4' />
      <div className='grow' />
      <Footer data={data} />
    </div>
  )
}

export default ArticleCard
