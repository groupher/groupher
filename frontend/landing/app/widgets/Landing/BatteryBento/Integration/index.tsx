import useHover from '~/hooks/useHover'
import useTrans from '~/hooks/useTrans'
import useSalon from '../../salon/battery_bento/integration'
import Panel from './Panel'

export default function Integration() {
  const [cardRef, isCardHovered] = useHover<HTMLDivElement>()
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div ref={cardRef} className={s.wrapper}>
      <Panel hovering={isCardHovered} />
      <div className={s.footer}>
        <h3 className={s.title}>{t('landing.battery.integration.title')}</h3>
        <div className={s.desc}>{t('landing.battery.integration.desc')}</div>
      </div>
    </div>
  )
}
