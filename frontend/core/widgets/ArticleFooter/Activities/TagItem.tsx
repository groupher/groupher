import useSalon from '../salon/activities/tag_item'

import TagSVG from '~/icons/Tag'

export default function TagItem() {
  const s = useSalon()

  return (
    <div className={s.item}>
      <div className={s.tail} />
      <TagSVG className={s.icon} />
      <div className={s.content}>
        <span className={s.highlight}>xxx</span>设置了标签 <span className={s.highlight}>xxx</span>
      </div>
    </div>
  )
}
