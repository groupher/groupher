import useHover from '~/hooks/useHover'

import Panel from './Panel'
import useSalon from '../../salon/battery_bento/security'

export default () => {
  const s = useSalon()
  const [cardRef, isCardHovered] = useHover<HTMLDivElement>()

  return (
    <div className={s.wrapper} ref={cardRef}>
      <Panel hovering={isCardHovered} />
      <div className={s.footer}>
        <h3 className={s.title}>掌控数据</h3>
        <div className={s.desc}>在安全的前提下，管理社区内容以及无缝部署迁移，来去自由。</div>
      </div>
    </div>
  )
}
