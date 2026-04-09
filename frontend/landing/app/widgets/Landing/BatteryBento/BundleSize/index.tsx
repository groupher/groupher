import useHover from '~/hooks/useHover'
import useTrans from '~/hooks/useTrans'
import useSalon from '../../salon/battery_bento/bundle_size'
import Panel from './Panel'

export default function BundleSize() {
  const s = useSalon()
  const { t } = useTrans()

  const [ref, isHovered] = useHover<HTMLDivElement>()

  return (
    <div ref={ref} className={s.wrapper}>
      <div className={s.banner}>
        <h3 className={s.title}>{t('landing.battery.bundle.title')}</h3>
        <div className={s.desc}>{t('landing.battery.bundle.desc')}</div>
      </div>
      <Panel hovering={isHovered} />
      <div className={s.warningMask} />
    </div>
  )
}
