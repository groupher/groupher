import useHover from '~/hooks/useHover'
import useSalon from '../../salon/battery_bento/bundle_size'
import Panel from './Panel'

export default function BundleSize() {
  const s = useSalon()

  const [ref, isHovered] = useHover<HTMLDivElement>()

  return (
    <div ref={ref} className={s.wrapper}>
      <div className={s.banner}>
        <h3 className={s.title}>精简 & 轻量</h3>
        <div className={s.desc}>对比国内外同类服务，体积更小</div>
      </div>
      <Panel hovering={isHovered} />
      <div className={s.warningMask} />
    </div>
  )
}
