import useSalon from '../salon/activities/mention_item'

import MentionSVG from '~/icons/Mention'

export default () => {
  const s = useSalon()

  return (
    <div className={s.item}>
      <div className={s.tail} />
      <MentionSVG className={s.icon} />
      <div className={s.content}>
        <span className={s.highlight}>xxx </span>在
        <span className={s.highlight}>这个社区太棒了</span>中提及
      </div>
    </div>
  )
}
