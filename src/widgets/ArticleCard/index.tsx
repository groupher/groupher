import type { FC } from 'react'
import Link from 'next/link'

import type { TArticle } from '~/spec'
import { THREAD } from '~/const/thread'
import { cutRest } from '~/fmt'
import { previewArticle } from '~/signal'
import useViewingCommunity from '~/hooks/useViewingCommunity'

import ArticleReadLabel from '~/widgets/ArticleReadLabel'
import ArticlePinLabel from '~/widgets/ArticlePinLabel'
import { Br } from '~/widgets/Common'
import ArticleImgWindow from '~/widgets/ArticleImgWindow'

import Footer from './Footer'

import useSalon from './salon'

export type TProps = {
  data: TArticle
}

const ArticleCard: FC<TProps> = ({ data }) => {
  const s = useSalon()

  const { slug } = useViewingCommunity()
  const { innerId, title, digest, isPinned, viewerHasViewed } = data

  return (
    <div className={s.wrapper}>
      <div className={s.pinHintDot}>
        <ArticlePinLabel isPinned={isPinned} top={0} left={0} />
      </div>

      <div className={s.viewHintDot}>
        <ArticleReadLabel viewed={viewerHasViewed} top={0} right={0} />
      </div>

      <div className="mt-1" />
      <Link
        className={s.titleLink}
        onClick={(e) => {
          e.preventDefault()
          previewArticle(data)
        }}
        href={`/${slug}/${THREAD.POST}/${innerId}`}
      >
        {title}
      </Link>

      <div onClick={() => previewArticle(data)}>{cutRest(digest, 150)}</div>

      <div className="mt-1" />
      <Br top={4} />
      <ArticleImgWindow />
      <div className="mt-4" />
      <div className="grow" />
      <Footer data={data} />
    </div>
  )
}

export default ArticleCard
