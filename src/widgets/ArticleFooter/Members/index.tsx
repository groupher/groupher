import useViewingArticle from '~/hooks/useViewingArticle'

import UserList from './UserList'
import useSalon from '../salon/members'

export default () => {
  const s = useSalon()

  const { article } = useViewingArticle()
  const { meta, upvotesCount, commentsParticipantsCount, commentsParticipants } = article

  return (
    <div className={s.wrapper}>
      <div className={s.title}>赞同 ({upvotesCount})</div>
      <UserList users={meta.latestUpvotedUsers} />
      <div className="mb-5" />
      <div className={s.title}>参与评论 ({commentsParticipantsCount})</div>
      <UserList users={commentsParticipants} />
    </div>
  )
}
