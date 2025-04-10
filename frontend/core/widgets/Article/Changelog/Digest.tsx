/*
 * Changelog Layout
 */

import type { FC } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import type { TChangelog } from '~/spec'

import { ARTICLE_THREAD } from '~/const/thread'

import Img from '~/Img'
import ArrowSVG from '~/icons/Arrow'

import ArticleBaseStats from '~/widgets/ArticleBaseStats'
import Share from '~/widgets/Share'
import ArticleSettingMenu from '~/widgets/ArticleSettingMenu'

import useSalon from '../salon/changelog/digest'

type TProps = {
  article: TChangelog
}

const ChangelogLayout: FC<TProps> = ({ article }) => {
  const s = useSalon()

  const router = useRouter()
  const { innerId, author, title } = article

  const backUrl = `/${article.communitySlug}/${ARTICLE_THREAD.CHANGELOG}`

  return (
    <div className={s.wrapper}>
      <div className={s.leftPart}>
        <div className={s.topping}>
          <div className={s.backBtn} onClick={() => router.push(backUrl)}>
            <ArrowSVG className={s.backIcon} />
            <div className={s.backText}>讨论区</div>
          </div>

          <div className="grow" />
          <Share modalOffset="38%" />
          <ArticleSettingMenu left={2} />
        </div>
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

export default ChangelogLayout
