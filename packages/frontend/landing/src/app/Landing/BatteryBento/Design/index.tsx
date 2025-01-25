import useHover from '~/hooks/useHover'

import Panel from './Panel'
import useSalon from '../../salon/battery_bento/design'

export default () => {
  const s = useSalon()
  const [cardRef, isCardHovered] = useHover<HTMLDivElement>()

  return (
    <div className={s.wrapper} ref={cardRef}>
      <Panel hovering={isCardHovered} />
      <div className={s.footer}>
        <h3 className={s.title}>默认好看</h3>
        <div className={s.desc}>走心设计团队，丰富自定义细节，为您的产品生态添砖加瓦。</div>
      </div>
    </div>
  )
}
