import useTrans from '~/hooks/useTrans'
import GtdWipSVG from '~/icons/GtdWip'

import useSalon from '../salon/activities/gtd_item'

export default function GtdItem() {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.item}>
      <div className={s.tail} />
      <GtdWipSVG className={s.icon} />
      <div className={s.content}>
        <span className={s.highlight}>bbb</span>
        {t('article.footer.activity.changed_status')}{' '}
        <span className={s.highlight}>{t('article.footer.status.wip')}</span>
      </div>
    </div>
  )
}
