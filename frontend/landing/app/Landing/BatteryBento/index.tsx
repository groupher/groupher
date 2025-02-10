import MobileFirst from './MobileFirst'
import BundleSize from './BundleSize'
import RichContent from './RichContent'
import DarkMode from './DarkMode'
import Security from './Security'
import Design from './Design'
import Integration from './Integration'
import Statistics from './Statistics'

import GridBlocks from './GridBlocks'

import useSalon from '../salon/battery_bento'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <section className={s.slogan}>
        <h3 className={s.title}>自带电池、开箱即用</h3>
        <div className={s.desc}>无需繁琐配置，即刻拥有功能完善的反馈社区</div>
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
    </div>
  )
}
