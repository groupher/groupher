import useHover from '~/hooks/useHover'
import useTrans from '~/hooks/useTrans'

import useSalon from '../../salon/battery_bento/mobile_first'
import Blocks from './Blocks'
import Panel from './Panel'

export default function MobileFirst() {
  const s = useSalon()
  const { t } = useTrans()
  const [ref, isHovered] = useHover<HTMLDivElement>()

  return (
    <div ref={ref} className={s.wrapper}>
      <div className={s.header}>
        <h3 className={s.title}>{t('landing.battery.mobile.title')}</h3>
        <div className={s.desc}>{t('landing.battery.mobile.desc')}</div>
      </div>
      <Panel hovering={isHovered} />
      <Blocks hovering={isHovered} />
    </div>
  )
}
