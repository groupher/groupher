import useHover from '~/hooks/useHover'

import Panel from './Panel'
import Blocks from './Blocks'

import useSalon from '../../salon/battery_bento/mobile_first'

export default () => {
  const s = useSalon()
  const [ref, isHovered] = useHover<HTMLDivElement>()

  return (
    <div ref={ref} className={s.wrapper}>
      <div className={s.header}>
        <h3 className={s.title}>移动端友好</h3>
        <div className={s.desc}>所有内容自适应手机、平板等小屏幕尺寸，功能与桌面端一致。</div>
      </div>
      <Panel hovering={isHovered} />
      <Blocks hovering={isHovered} />
    </div>
  )
}
