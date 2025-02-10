import useHover from '~/hooks/useHover'

import Panel from './Panel'
import useSalon from '../../salon/battery_bento/statistics'

export default () => {
  const s = useSalon()
  const [cardRef, isCardHovered] = useHover<HTMLDivElement>()

  return (
    <div ref={cardRef} className={s.wrapper}>
      <Panel hovering={isCardHovered} />
      <div className={s.footer}>
        <h3 className={s.title}>统计分析</h3>
        <div className={s.desc}>社区访问趋势，地域分布，站点来源等，进一步了解你的产品用户。</div>
      </div>
    </div>
  )
}
