import { UPVOTE_LAYOUT } from '~/const/layout'
import Img from '~/Img'
import { upvoteArticle } from '~/signal'
import useArticle from '~/stores/article/hooks'
import ArticleCatState from '~/unit/ArticleCatState'
import TagsList from '~/unit/TagsList'
import Upvote from '~/unit/Upvote'
import ReadableDate from '~/widgets/ReadableDate'

import useSalon from './salon/side_info'

export default function SideInfo() {
  const s = useSalon()
  const { article } = useArticle()

  if (!article) {
    return <h1>Error article</h1>
  }

  const { insertedAt, communityTags, upvotesCount, meta, viewerHasUpvoted, cat, state } = article
  const { latestUpvotedUsers } = meta

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        <Upvote
          count={upvotesCount}
          avatarList={latestUpvotedUsers}
          viewerHasUpvoted={viewerHasUpvoted}
          onAction={(viewerHasUpvoted) => upvoteArticle(article, viewerHasUpvoted)}
          type={UPVOTE_LAYOUT.ARTICLE}
          bottom={8}
        />
        <div className={s.label}>
          参与投票 <div className={s.count}>{upvotesCount}</div>
        </div>
        <div className={s.userList}>
          {latestUpvotedUsers.map((user) => (
            <div key={user.login} className={s.user}>
              <Img src={user.avatar} className={s.avatar} />
            </div>
          ))}
        </div>
        <div className='mb-6' />
        <div className={s.label}>标签</div>
        <TagsList items={communityTags} size='medium' left={1} max={20} bottom={2} />
        <div className='mb-6' />
        <div className={s.label}>分类</div>
        <ArticleCatState cat={cat} state={state} smaller={false} />
        <div className='mb-6' />
        <div className={s.label}>发布时间</div>
        <div className={s.value}>
          <ReadableDate date={insertedAt} withTime={false} />
        </div>
      </div>

      <div className={s.divider} />
    </div>
  )
}
