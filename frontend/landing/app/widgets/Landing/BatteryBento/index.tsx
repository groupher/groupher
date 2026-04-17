import useTrans from '~/hooks/useTrans'
import useSalon from '../salon/battery_bento'
import BundleSize from './BundleSize'
import DarkMode from './DarkMode'
import Design from './Design'
import GridBlocks from './GridBlocks'
import Integration from './Integration'
import MobileFirst from './MobileFirst'
import RichContent from './RichContent'
import Security from './Security'
import Statistics from './Statistics'

export default function BatteryBento() {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <section className={s.wrapper}>
      <section className={s.slogan}>
        <h3 className={s.title}>{t('landing.battery.title')}</h3>
        <div className={s.desc}>{t('landing.battery.desc')}</div>
      </section>
      <div className={s.cards}>
        <div className={s.leftCards}>
          <MobileFirst />
          <RichContent />
          <DarkMode />
          <Integration />
        </div>
        <BundleSize />
      </div>
      <div className={s.footerCards}>
        <Security />
        <Statistics />
        <Design />
      </div>

      <GridBlocks />
    </section>
  )
}
