import GtdWipSVG from '~/icons/GtdWip'

import useSalon from '../salon/activities/gtd_item'

export default () => {
  const s = useSalon()

  return (
    <div className={s.item}>
      <div className={s.tail} />
      <GtdWipSVG className={s.icon} />
      <div className={s.content}>
        <span className={s.highlight}>bbb</span>将状态改为{' '}
        <span className={s.highlight}>进行中</span>
      </div>
    </div>
  )
}
