import useTrans from '~/hooks/useTrans'
import useViewingArticle from '~/hooks/useViewingArticle'

import useSalon from '../salon/members'
import UserList from './UserList'

export default function Members() {
  const s = useSalon()
  const { t } = useTrans()

  const { article } = useViewingArticle()
  const { meta, upvotesCount, commentsParticipantsCount, commentsParticipants } = article

  return (
    <div className={s.wrapper}>
      <div className={s.title}>
        {t('article.footer.members.upvotes')} ({upvotesCount})
      </div>
      <UserList users={meta.latestUpvotedUsers} />
      <div className='mb-5' />
      <div className={s.title}>
        {t('article.footer.members.comments')} ({commentsParticipantsCount})
      </div>
      <UserList users={commentsParticipants} />
    </div>
  )
}
