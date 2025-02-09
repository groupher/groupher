import { upvoteArticle } from '~/signal'
import useViewingArticle from '~/hooks/useViewingArticle'
import { UPVOTE_LAYOUT } from '~/const/layout'

import Img from '~/Img'
import Upvote from '~/widgets/Upvote'
import ArticleCatState from '~/widgets/ArticleCatState'
import TagsList from '~/widgets/TagsList'
import ReadableDate from '~/widgets/ReadableDate'

import useSalon from '../salon/post/side_info'

export default () => {
  const s = useSalon()
  const { article } = useViewingArticle()

  const { insertedAt, articleTags, upvotesCount, meta, viewerHasUpvoted, cat, state } = article
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
              <div className={s.nickname}>{user.nickname}</div>
            </div>
          ))}
        </div>

        <div className="mb-6" />
        <div className={s.label}>标签</div>
        <TagsList items={articleTags} size="medium" left={1} max={20} bottom={2} />

        <div className="mb-6" />
        <div className={s.label}>分类</div>
        <ArticleCatState cat={cat} state={state} smaller={false} />
        <div className="mb-6" />

        <div className={s.label}>发布时间</div>
        <div className={s.value}>
          <ReadableDate date={insertedAt} withTime={false} />
        </div>
      </div>

      <div className={s.divider} />
    </div>
  )
}
