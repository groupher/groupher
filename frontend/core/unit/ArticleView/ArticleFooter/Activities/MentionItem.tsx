import useTrans from '~/hooks/useTrans'
import MentionSVG from '~/icons/Mention'

import useSalon from '../salon/activities/mention_item'

export default function MentionItem() {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.item}>
      <div className={s.tail} />
      <MentionSVG className={s.icon} />
      <div className={s.content}>
        <span className={s.highlight}>xxx </span>
        {t('article.footer.activity.mentioned_in')}
        <span className={s.highlight}>{t('article.footer.demo.mention_title')}</span>
        {t('article.footer.activity.mentioned_suffix')}
      </div>
    </div>
  )
}
