/*
 * PostLayout
 */

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ARTICLE_THREAD } from '~/const/thread'
import Img from '~/Img'
import ArrowSVG from '~/icons/Arrow'
import useArticle from '~/stores/article/hooks'

// import ArchivedSign from '~/widgets/ArchivedSign'

import type { TPost } from '~/spec'
import ArticleSettingMenu from '~/unit/article-setting-menu'
import ArticleBaseStats from '~/unit/article-view/ArticleBaseStats'
import ArticlePinLabel from '~/unit/post-thread/ArticlePinLabel'
import Share from '~/unit/share'
import ImgFallback from '~/widgets/ImgFallback'
import useSalon from './salon/digest'

export default function Digest() {
  const router = useRouter()
  const { post } = useArticle()

  const isPinned = post?.isPinned ?? false
  const s = useSalon({ isPinned })

  if (!post) {
    return <h1>Error article</h1>
  }

  const { innerId, author, title } = post

  const backUrl = `/${post.communitySlug}/${ARTICLE_THREAD.POST}`

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
          <ArticleBaseStats article={post as TPost} right={2} />
        </div>
      </div>
    </div>
  )
}
