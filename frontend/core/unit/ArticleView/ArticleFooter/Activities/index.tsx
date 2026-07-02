import useTrans from '~/hooks/useTrans'
import Img from '~/Img'
import { mockUsers } from '~/mock'
import ImgFallback from '~/widgets/ImgFallback'

import useSalon, { cn } from '../salon/activities'
import GtdItem from './GtdItem'
import MentionItem from './MentionItem'
import TagItem from './TagItem'

export default function Activities() {
  const s = useSalon()
  const { t } = useTrans()

  const user = mockUsers(1)[0]

  return (
    <div className={s.wrapper}>
      <div className={s.item}>
        <div className={cn(s.tail, '-bottom-3.5 h-2.5')} />
        <Img
          src={user.avatar}
          className={s.avatar}
          fallback={<ImgFallback user={user} left={-0.5} />}
        />

        <div className={s.content}>
          <span className={cn(s.highlight, 'mr-1')}>mydearxym</span>
          {t('article.footer.activity.published_at')} 3 {t('article.footer.time.days_ago')}
        </div>
      </div>

      <TagItem />
      <GtdItem />
      <MentionItem />

      <div className={s.lastUpdate}>
        {t('article.footer.activity.last_reply')}: 14 {t('article.footer.time.days_ago')}
      </div>
    </div>
  )
}
