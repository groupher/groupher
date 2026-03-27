/*
 *
 * ChangelogItem
 *
 */

import Link from 'next/link'
import { type FC, memo } from 'react'
import { THREAD } from '~/const/thread'
import ShareSVG from '~/icons/Share'
import type { TChangelog } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import CommentsCount from '~/unit/comments-count'
import EmotionSelector from '~/unit/emotion-selector'
import CoverImage from '~/widgets/CoverImage'
import ReadableDate from '~/widgets/ReadableDate'

import { demoEmotion, demoTags } from '../constant'

import SolidTagList from '../SolidTagList'
import useSalon from '../salon/classic_layout/article_layout'
import Author from './Author'

type TProps = {
  article: TChangelog
}

const ClassicLayout: FC<TProps> = ({ article }) => {
  const s = useSalon()
  const { slug } = useCommunity()

  return (
    <div className={s.wrapper}>
      <div className={s.main}>
        <CoverImage />
        <Link
          className={s.title}
          href={`/${slug}/${THREAD.CHANGELOG}/${article.innerId}`}
          scroll={false}
          data-preview-id={String(article.innerId)}
        >
          {article.title}
          <div className={s.version}>v3.21</div>
        </Link>
        <div className={s.tags}>
          <SolidTagList tags={demoTags} />
          <div className={s.dateTime}>
            <ReadableDate date={article.insertedAt} withTime={false} />
          </div>
        </div>
        <div className={s.body}>
          这次俄乌冲突出现侮辱乌女性的评论就是1450干的，刷完评论就截图转发外网，成为外媒攻击中国人的“口实”。
          这种行为十分危险，战争期间各种武装组织骚动，随时对我国在乌克兰撤侨的6000人直接造成生命威胁。前段时间，刘学州那个找爸妈的孩子，也是被1450它们网暴死的。
          （1450罪恶滔天啊！1450是九世恶人下凡！连孩子都不放过。
        </div>
        <Author user={article.author} />
        <div className={s.footer}>
          <EmotionSelector emotions={demoEmotion} isLegal />
          <div className='grow' />
          <CommentsCount count={article.commentsCount} size='medium' right={15} />
          <ShareSVG className={s.shareIcon} />
        </div>
      </div>
    </div>
  )
}

export default memo(ClassicLayout)
