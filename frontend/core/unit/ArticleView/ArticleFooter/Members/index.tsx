import useTrans from '~/hooks/useTrans'
import useViewingArticle from '~/hooks/useViewingArticle'

import useSalon from '../salon/members'
import UserList from './UserList'

export default function Members() {
  const s = useSalon()
  const { t } = useTrans()

  const { article, stats } = useViewingArticle()
  const { meta, commentsParticipants } = article

  return (
    <div className={s.wrapper}>
      <div className={s.title}>
        {t('article.footer.members.upvotes')}{' '}
        <span className='pretty-num'>({stats?.upvotesCount ?? 0})</span>
      </div>
      <UserList users={meta.latestUpvotedUsers} />
      <div className='mb-5' />
      <div className={s.title}>
        {t('article.footer.members.comments')} ({stats?.commentsParticipantsCount ?? 0})
      </div>
      <UserList users={commentsParticipants} />
    </div>
  )
}
