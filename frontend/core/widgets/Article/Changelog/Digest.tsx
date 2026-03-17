/*
 * PostLayout
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ARTICLE_THREAD } from '~/const/thread'
import useArticle from '~/hooks/useArticle'

import Img from '~/Img'
import ArrowSVG from '~/icons/Arrow'

// import ArchivedSign from '~/widgets/ArchivedSign'

import type { TChangelog } from '~/spec'
import ArticleBaseStats from '~/widgets/ArticleBaseStats'
import ArticlePinLabel from '~/widgets/ArticlePinLabel'
import ArticleSettingMenu from '~/widgets/ArticleSettingMenu'
import ImgFallback from '~/widgets/ImgFallback'
import Share from '~/widgets/Share'
import useSalon from '../salon/changelog/digest'

export default function Digest() {
  const router = useRouter()
  const { changelog } = useArticle()

  const isPinned = false
  const s = useSalon({ isPinned })

  if (!changelog) {
    return <h1>Error changelog</h1>
  }

  const { innerId, author, title } = changelog

  const backUrl = `/${changelog.communitySlug}/${ARTICLE_THREAD.CHANGELOG}`

  return (
    <div className={s.wrapper}>
      <div className={s.leftPart}>
        <div className={s.topping}>
          <button className={s.backBtn} onClick={() => router.push(backUrl)}>
            <ArrowSVG className={s.backIcon} />
            <div className={s.backText}>讨论区</div>
          </button>
          <div className='grow' />
          <Share modalOffset='35%' />
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
          <ArticleBaseStats article={changelog as TChangelog} right={2} />
        </div>
      </div>
    </div>
  )
}
