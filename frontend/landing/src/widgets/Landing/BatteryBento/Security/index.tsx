import useHover from '~/hooks/useHover'
import useTrans from '~/hooks/useTrans'

import useSalon from '../../salon/battery_bento/security'
import Panel from './Panel'

export default function Security() {
  const s = useSalon()
  const { t } = useTrans()
  const [cardRef, isCardHovered] = useHover<HTMLDivElement>()

  return (
    <div className={s.wrapper} ref={cardRef}>
      <Panel hovering={isCardHovered} />
      <div className={s.footer}>
        <h3 className={s.title}>{t('landing.battery.security.title')}</h3>
        <div className={s.desc}>{t('landing.battery.security.desc')}</div>
      </div>
    </div>
  )
}
