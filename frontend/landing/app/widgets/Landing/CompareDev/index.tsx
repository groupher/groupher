import useTrans from '~/hooks/useTrans'
import CheckSVG from '~/icons/CheckBold'
import CloseCrossSVG from '~/icons/CloseCross'
import useSalon, { cn } from '../salon/compare_dev'
import HighWay from './HighWay'
import OurWay from './OurWay'

export default function CompareDev() {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <section className={s.wrapper}>
      <div className={s.slogan}>
        <div className={s.topping}>{t('landing.compare.topping')}</div>
        <h3 className={s.title}>{t('landing.compare.title')}</h3>
        <div className={s.desc}>{t('landing.compare.desc')}</div>
      </div>
      <div className={s.ourWall}>
        <div className={s.ourWallBg} />
        <div className={s.greenDiffBar} />

        <div className={s.ourlabel}>
          <CheckSVG className={cn(s.checkIcon, s.fillGreen)} />
          {t('landing.compare.our_label')}
        </div>

        <OurWay />
      </div>
      <div className={s.theirWall}>
        <div className={s.theirWallBg} />
        <div className={s.redDiffBar} />

        <div className={s.theirlabel}>
          <CloseCrossSVG className={cn(s.checkIcon, s.fillRed)} />
          {t('landing.compare.their_label')}
        </div>
        <HighWay />
      </div>
    </section>
  )
}
