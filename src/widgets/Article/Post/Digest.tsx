/*
 * PostLayout
 */

import { useRouter } from 'next/navigation'
import Link from 'next/link'

import useViewingArticle from '~/hooks/useViewingArticle'
import { ARTICLE_THREAD } from '~/const/thread'

import Img from '~/Img'
import ArrowSVG from '~/icons/Arrow'

// import ArchivedSign from '~/widgets/ArchivedSign'

import ArticleBaseStats from '~/widgets/ArticleBaseStats'
import Share from '~/widgets/Share'
import ArticleSettingMenu from '~/widgets/ArticleSettingMenu'
import ArticlePinLabel from '~/widgets/ArticlePinLabel'

import useSalon from '../styles/post/digest'

export default () => {
  const router = useRouter()
  const { article } = useViewingArticle()

  const { innerId, author, title, isPinned } = article

  const s = useSalon({ isPinned })

  const backUrl = `/${article.originalCommunitySlug}/${ARTICLE_THREAD.POST}`

  return (
    <div className={s.wrapper}>
      <div className={s.leftPart}>
        <div className={s.topping}>
          <div className={s.backBtn} onClick={() => router.push(backUrl)}>
            <ArrowSVG className={s.backIcon} />
            <div className={s.backText}>讨论区</div>
          </div>
          <div className="grow" />
          <Share modalOffset="35%" />
          <ArticleSettingMenu left={2} />
        </div>

        <ArticlePinLabel isPinned={isPinned} top={56} />
        <div className={s.title}>
          {title}
          <div className={s.subTitle}>{innerId}</div>
        </div>
        <div className={s.bottomInfo}>
          <Link href="/" className={s.authorName}>
            <Img src={author.avatar} className={s.avatar} />
            {author.nickname}
          </Link>
          <ArticleBaseStats article={article} right={2} />
        </div>
      </div>
    </div>
  )
}
