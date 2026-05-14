/*
 * PostLayout
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { lazy, Suspense } from 'react'

import { THREAD_PATH } from '~/const/thread'
import ArrowSVG from '~/icons/Arrow'
import Img from '~/Img'
import type { TPost } from '~/spec'
// import ArchivedSign from '~/widgets/ArchivedSign'
import useArticle from '~/stores/article/hooks'
import ArticleSettingMenu from '~/unit/ArticleSettingMenu'
import ArticleBaseStats from '~/unit/ArticleView/ArticleBaseStats'
import ArticlePinLabel from '~/unit/PostThread/ArticlePinLabel'
import ImgFallback from '~/widgets/ImgFallback'

import useSalon from './salon/digest'

const Share = lazy(() => import('~/unit/Share'))

export default function Digest() {
  const { push } = useRouter()
  const { post } = useArticle()

  const isPinned = post?.isPinned ?? false
  const s = useSalon({ isPinned })

  if (!post) {
    return <h1>Error article</h1>
  }

  const { innerId, author, title } = post

  const backUrl = `/${post.communitySlug}/${THREAD_PATH.POST}`

  return (
    <div className={s.wrapper}>
      <div className={s.leftPart}>
        <div className={s.topping}>
          <button type='button' className={s.backBtn} onClick={() => push(backUrl)}>
            <ArrowSVG className={s.backIcon} />
            <div className={s.backText}>讨论区</div>
          </button>
          <div className='grow' />
          <Suspense fallback={null}>
            <Share modalOffset='35%' />
          </Suspense>
          <ArticleSettingMenu left={2} />
        </div>

        <ArticlePinLabel isPinned={isPinned} className='top-14' />
        <div className={s.title}>
          {title}
          <div className={s.subTitle}>{innerId}</div>
        </div>
        <div className={s.bottomInfo}>
          <Link href='/' className={s.authorName}>
            <Img
              src={author.avatar}
              className={s.avatar}
              fallback={<ImgFallback user={author} />}
            />
            {author.nickname}
          </Link>
          <ArticleBaseStats article={post as TPost} right={2} />
        </div>
      </div>
    </div>
  )
}
