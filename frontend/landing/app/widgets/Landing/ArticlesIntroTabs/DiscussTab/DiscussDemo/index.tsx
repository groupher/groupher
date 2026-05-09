import type { FC } from 'react'

import { COLOR } from '~/const/colors'
import { ARTICLE_CAT } from '~/const/gtd'
import useTrans from '~/hooks/useTrans'
import CommentSVG from '~/icons/Comment'
import UpvoteSVG from '~/icons/Upvote'
import { mockUsers } from '~/mock'
import ArticleCatStatus from '~/unit/ArticleCatStatus'
import Facepile from '~/widgets/Facepile/LandingPage'
import TagNode from '~/widgets/TagNode'

import useSalon, { cn } from '../../../salon/articles_intro_tabs/discuss_tab/discuss_demo'
import CommentItem from './CommentItem'
import PostItem from './PostItem'

const DiscussDemo: FC = () => {
  const s = useSalon()
  const { t } = useTrans()

  const users = mockUsers(10)

  return (
    <div className={s.wrapper}>
      <div className={s.listCard}>
        <PostItem
          count={101}
          className='opacity-85'
          title={t('landing.articles.discuss.demo.item.0')}
          cat={ARTICLE_CAT.IDEA}
          active
        />
        <PostItem
          className='opacity-75'
          count={65}
          title={t('landing.articles.discuss.demo.item.1')}
          cat={ARTICLE_CAT.BUG}
        />
        <PostItem
          className='opacity-65'
          count={44}
          title={t('landing.articles.discuss.demo.item.2')}
        />
        <PostItem
          className='opacity-50'
          count={86}
          title={t('landing.articles.discuss.demo.item.3')}
          cat={ARTICLE_CAT.QA}
        />
        <PostItem
          className='opacity-30'
          count={74}
          title={t('landing.articles.discuss.demo.item.4')}
          cat={ARTICLE_CAT.QA}
        />
        <PostItem
          className='opacity-25'
          count={13}
          title={t('landing.articles.discuss.demo.item.5')}
          cat={ARTICLE_CAT.QA}
        />
      </div>

      <div className={s.detailCard}>
        <div className={s.header}>
          <ArticleCatStatus cat={ARTICLE_CAT.IDEA} right={3} />
          <div className={s.tagBox}>
            <TagNode color={COLOR.PURPLE} boldHash />
            <div className={s.tag}>{t('landing.articles.discuss.demo.tag')}</div>
          </div>
        </div>

        <div className={s.title}>{t('landing.articles.discuss.demo.item.0')}</div>
        <div className={s.status}>
          <div className={s.upvote}>
            <UpvoteSVG className={s.icon} />
            <div className={s.count}>101</div>
          </div>

          <Facepile users={users.slice(3, 6)} className='mt-0.5 scale-75 gap-x-1.5 opacity-65' />

          <div className='grow' />
          <CommentSVG className={s.commentIcon} />
          <div className={s.commentCount}>18</div>
        </div>

        <div className={s.content}>
          <div className={cn(s.bar, 'w-8/12')} />
          <div className={cn(s.bar, 'w-10/12 top-5 opacity-25')} />
          <div className={cn(s.bar, 'w-6/12 top-10 opacity-25')} />
          <div className={cn(s.bar, 'w-4/12 top-14 mt-1 opacity-20')} />
        </div>

        <div className={s.commentsHeader}>
          {t('landing.articles.discuss.demo.comments')} <div className={s.commentCount}>18</div>
          <div className='grow' />
          <div className={cn(s.bar, 'w-8 mt-1 right-6 opacity-15')} />
        </div>

        <CommentItem user={users[0]} className='opacity-90' />
        <CommentItem user={users[1]} className='opacity-65' />
        <CommentItem user={users[2]} className='opacity-40' />
      </div>
    </div>
  )
}

export default DiscussDemo
