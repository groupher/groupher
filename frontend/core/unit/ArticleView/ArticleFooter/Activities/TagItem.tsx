import useTrans from '~/hooks/useTrans'
import TagSVG from '~/icons/Tag'

import useSalon from '../salon/activities/tag_item'

export default function TagItem() {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.item}>
      <div className={s.tail} />
      <TagSVG className={s.icon} />
      <div className={s.content}>
        <span className={s.highlight}>xxx</span>
        {t('article.footer.activity.set_tag')} <span className={s.highlight}>xxx</span>
      </div>
    </div>
  )
}
